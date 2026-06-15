import numpy as np
from scipy import stats as scipy_stats
import statsmodels.api as sm
from typing import Any


def _cohens_d(group1: list, group2: list) -> float:
    n1, n2 = len(group1), len(group2)
    s = np.sqrt(((n1 - 1) * np.std(group1, ddof=1) ** 2 + (n2 - 1) * np.std(group2, ddof=1) ** 2) / (n1 + n2 - 2))
    return float(abs(np.mean(group1) - np.mean(group2)) / s) if s > 0 else 0.0


def _effect_label(d: float, metric: str = "d") -> str:
    if metric == "d":
        if d < 0.2: return "negligible"
        if d < 0.5: return "small"
        if d < 0.8: return "medium"
        return "large"
    if metric == "r":
        if d < 0.1: return "negligible"
        if d < 0.3: return "small"
        if d < 0.5: return "medium"
        return "large"
    if metric == "eta2":
        if d < 0.01: return "negligible"
        if d < 0.06: return "small"
        if d < 0.14: return "medium"
        return "large"
    return "unknown"


def run_independent_ttest(group1: list[float], group2: list[float]) -> dict[str, Any]:
    # Use Welch's t-test (equal_var=False) and a Welch–Satterthwaite df so the
    # t-statistic, p-value, df and 95% CI all derive from the SAME variance
    # model. The previous implementation mixed Student's t (pooled) with a
    # Welch standard error, producing CI that didn't match the reported t.
    t, p = scipy_stats.ttest_ind(group1, group2, equal_var=False)
    d = _cohens_d(group1, group2)
    n1, n2 = len(group1), len(group2)
    v1 = float(np.var(group1, ddof=1))
    v2 = float(np.var(group2, ddof=1))
    se = float(np.sqrt(v1 / n1 + v2 / n2))
    # Welch–Satterthwaite degrees of freedom
    numerator = (v1 / n1 + v2 / n2) ** 2
    denominator = ((v1 / n1) ** 2) / (n1 - 1) + ((v2 / n2) ** 2) / (n2 - 1) if (n1 > 1 and n2 > 1) else 0
    df = float(numerator / denominator) if denominator > 0 else float(n1 + n2 - 2)
    mean_diff = float(np.mean(group1) - np.mean(group2))
    ci = scipy_stats.t.interval(0.95, df=df, loc=mean_diff, scale=se)
    return {
        "statistic": float(t),
        "p_value": float(p),
        "effect_size": d,
        "effect_label": _effect_label(d, "d"),
        "ci_95": [float(ci[0]), float(ci[1])],
        "df": df,
        "mean_difference": mean_diff,
        "test_type": "welch",
    }


def run_paired_ttest(pre: list[float], post: list[float]) -> dict[str, Any]:
    t, p = scipy_stats.ttest_rel(pre, post)
    diffs = np.array(post) - np.array(pre)
    sd_diff = float(np.std(diffs, ddof=1))
    d = float(np.mean(diffs) / sd_diff) if sd_diff > 0 else 0.0
    df = len(pre) - 1
    se_diff = sd_diff / np.sqrt(len(pre))
    ci = scipy_stats.t.interval(0.95, df=df, loc=float(np.mean(diffs)), scale=float(se_diff))
    return {
        "statistic": float(t),
        "p_value": float(p),
        "effect_size": abs(d),
        "effect_label": _effect_label(abs(d), "d"),
        "ci_95": [float(ci[0]), float(ci[1])],
        "df": df,
        "mean_difference": float(np.mean(diffs)),
    }


def run_one_way_anova(*groups: list[float]) -> dict[str, Any]:
    f, p = scipy_stats.f_oneway(*groups)
    all_data = np.concatenate(groups)
    grand_mean = np.mean(all_data)
    ss_between = sum(len(g) * (np.mean(g) - grand_mean) ** 2 for g in groups)
    ss_total = np.sum((all_data - grand_mean) ** 2)
    eta2 = float(ss_between / ss_total) if ss_total > 0 else 0.0
    return {
        "statistic": float(f),
        "p_value": float(p),
        "effect_size": eta2,
        "effect_label": _effect_label(eta2, "eta2"),
        "ci_95": None,
        "df_between": len(groups) - 1,
        "df_within": sum(len(g) for g in groups) - len(groups),
    }


def run_pearson(x: list[float], y: list[float]) -> dict[str, Any]:
    r, p = scipy_stats.pearsonr(x, y)
    n = len(x)
    ci_low = np.tanh(np.arctanh(r) - 1.96 / np.sqrt(n - 3))
    ci_high = np.tanh(np.arctanh(r) + 1.96 / np.sqrt(n - 3))
    return {
        "statistic": float(r),
        "p_value": float(p),
        "effect_size": abs(float(r)),
        "effect_label": _effect_label(abs(float(r)), "r"),
        "ci_95": [float(ci_low), float(ci_high)],
    }


def run_spearman(x: list[float], y: list[float]) -> dict[str, Any]:
    r, p = scipy_stats.spearmanr(x, y)
    return {
        "statistic": float(r),
        "p_value": float(p),
        "effect_size": abs(float(r)),
        "effect_label": _effect_label(abs(float(r)), "r"),
        "ci_95": None,
    }


def run_multiple_regression(y: list[float], X: list[list[float]]) -> dict[str, Any]:
    X_arr = sm.add_constant(np.array(X))
    model = sm.OLS(np.array(y), X_arr).fit()
    return {
        "statistic": float(model.fvalue),
        "p_value": float(model.f_pvalue),
        "effect_size": float(model.rsquared),
        "effect_label": _effect_label(float(model.rsquared), "eta2"),
        "ci_95": None,
        "r_squared": float(model.rsquared),
        "adj_r_squared": float(model.rsquared_adj),
        "coefficients": model.params.tolist(),
        "coef_pvalues": model.pvalues.tolist(),
    }


def run_chi_square(observed: list[list[int]]) -> dict[str, Any]:
    chi2, p, dof, _ = scipy_stats.chi2_contingency(observed)
    arr = np.array(observed)
    n = arr.sum()
    k = min(arr.shape) - 1
    cramers_v = float(np.sqrt(chi2 / (n * k))) if n * k > 0 else 0.0
    return {
        "statistic": float(chi2),
        "p_value": float(p),
        "effect_size": cramers_v,
        "effect_label": _effect_label(cramers_v, "r"),
        "ci_95": None,
        "df": int(dof),
    }


TEST_DISPATCH = {
    "independent_ttest": lambda d: run_independent_ttest(d["group1"], d["group2"]),
    "paired_ttest": lambda d: run_paired_ttest(d["pre"], d["post"]),
    "one_way_anova": lambda d: run_one_way_anova(*d["groups"]),
    "pearson": lambda d: run_pearson(d["x"], d["y"]),
    "spearman": lambda d: run_spearman(d["x"], d["y"]),
    "multiple_regression": lambda d: run_multiple_regression(d["y"], d["X"]),
    "chi_square": lambda d: run_chi_square(d["observed"]),
}


def run_analysis(test_type: str, data: dict[str, Any]) -> dict[str, Any]:
    fn = TEST_DISPATCH.get(test_type)
    if not fn:
        raise ValueError(f"Unknown test type: {test_type}")
    return fn(data)


# ---------------------------------------------------------------------------
# Survey-response → test-input extractors
# ---------------------------------------------------------------------------
# answers_json keys come from the public survey form ("q_0", "q_1", ...) and
# values arrive as strings. These helpers coerce numerics and skip missing/
# unparseable cells so a single bad row does not kill the whole analysis.


def _coerce_float(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _numeric_pairs(rows: list[dict], k1: str, k2: str) -> tuple[list[float], list[float]]:
    a: list[float] = []
    b: list[float] = []
    for r in rows:
        x = _coerce_float(r.get(k1))
        y = _coerce_float(r.get(k2))
        if x is not None and y is not None:
            a.append(x)
            b.append(y)
    return a, b


def _str_value(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def build_test_data(
    test_type: str,
    answers: list[dict],
    mapping: dict[str, Any],
) -> dict[str, Any]:
    """Build the inputs that `run_analysis` expects from raw survey rows."""

    def _required(key: str) -> str:
        v = mapping.get(key)
        if not v:
            raise ValueError(f"Mapping field '{key}' is required for {test_type}")
        return v

    if test_type == "independent_ttest":
        outcome = _required("outcome_q")
        grouping = _required("grouping_q")
        group_values = mapping.get("group_values")
        if not group_values:
            # Auto-detect: take the two most-common non-empty values.
            # Tie-break alphabetically so group ordering is deterministic across runs.
            counts: dict[str, int] = {}
            for r in answers:
                v = _str_value(r.get(grouping))
                if v is not None:
                    counts[v] = counts.get(v, 0) + 1
            group_values = sorted(counts, key=lambda k: (-counts[k], k))[:2]
            if len(group_values) < 2:
                raise ValueError("Need at least 2 distinct values in grouping question")
        if len(group_values) != 2:
            raise ValueError("independent_ttest requires exactly 2 group values")
        g1, g2 = [], []
        for r in answers:
            label = _str_value(r.get(grouping))
            score = _coerce_float(r.get(outcome))
            if label is None or score is None:
                continue
            if label == group_values[0]:
                g1.append(score)
            elif label == group_values[1]:
                g2.append(score)
        if len(g1) < 2 or len(g2) < 2:
            raise ValueError("Each group needs at least 2 valid responses")
        return {"group1": g1, "group2": g2}

    if test_type == "paired_ttest":
        pre = _required("pre_q")
        post = _required("post_q")
        a, b = _numeric_pairs(answers, pre, post)
        if len(a) < 2:
            raise ValueError("Need at least 2 paired responses")
        return {"pre": a, "post": b}

    if test_type == "one_way_anova":
        outcome = _required("outcome_q")
        grouping = _required("grouping_q")
        group_values = mapping.get("group_values")
        if not group_values:
            counts = {}
            for r in answers:
                v = _str_value(r.get(grouping))
                if v is not None:
                    counts[v] = counts.get(v, 0) + 1
            # Tie-break alphabetically for deterministic ordering.
            group_values = sorted(counts, key=lambda k: (-counts[k], k))[:6]
        if len(group_values) < 2:
            raise ValueError("ANOVA needs at least 2 groups")
        if len(group_values) > 6:
            raise ValueError("ANOVA limited to 6 groups")
        groups: list[list[float]] = [[] for _ in group_values]
        index = {v: i for i, v in enumerate(group_values)}
        for r in answers:
            label = _str_value(r.get(grouping))
            score = _coerce_float(r.get(outcome))
            if label is None or score is None or label not in index:
                continue
            groups[index[label]].append(score)
        if any(len(g) < 2 for g in groups):
            raise ValueError("Each group needs at least 2 valid responses")
        return {"groups": groups}

    if test_type in ("pearson", "spearman"):
        x_key = _required("x_q")
        y_key = _required("y_q")
        x, y = _numeric_pairs(answers, x_key, y_key)
        if len(x) < 3:
            raise ValueError("Need at least 3 valid pairs")
        return {"x": x, "y": y}

    if test_type == "multiple_regression":
        y_key = _required("y_q")
        x_keys = mapping.get("x_qs") or []
        if not x_keys:
            raise ValueError("multiple_regression needs at least one predictor in x_qs")
        # Detect predictors with zero numeric values up front so the error
        # blames the right field instead of saying "not enough rows".
        for k in x_keys:
            if not any(_coerce_float(r.get(k)) is not None for r in answers):
                raise ValueError(
                    f"Predictor '{k}' has no numeric values; "
                    "categorical predictors aren't supported in linear regression"
                )
        if not any(_coerce_float(r.get(y_key)) is not None for r in answers):
            raise ValueError(f"Outcome '{y_key}' has no numeric values")
        y_vals: list[float] = []
        X: list[list[float]] = []
        for r in answers:
            yv = _coerce_float(r.get(y_key))
            xv = [_coerce_float(r.get(k)) for k in x_keys]
            if yv is None or any(v is None for v in xv):
                continue
            y_vals.append(yv)
            X.append([float(v) for v in xv])  # type: ignore[arg-type]
        if len(y_vals) < len(x_keys) + 2:
            raise ValueError("Not enough complete rows for regression")
        return {"y": y_vals, "X": X}

    if test_type == "chi_square":
        outcome = _required("outcome_q")  # category A (rows)
        grouping = _required("grouping_q")  # category B (columns)
        row_labels: list[str] = []
        col_labels: list[str] = []
        cells: dict[tuple[str, str], int] = {}
        for r in answers:
            a = _str_value(r.get(outcome))
            b = _str_value(r.get(grouping))
            if a is None or b is None:
                continue
            if a not in row_labels:
                row_labels.append(a)
            if b not in col_labels:
                col_labels.append(b)
            cells[(a, b)] = cells.get((a, b), 0) + 1
        if len(row_labels) < 2 or len(col_labels) < 2:
            raise ValueError("Chi-square needs at least 2 categories on each variable")
        observed = [[cells.get((rl, cl), 0) for cl in col_labels] for rl in row_labels]
        return {"observed": observed}

    raise ValueError(f"Unknown test type: {test_type}")
