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
    t, p = scipy_stats.ttest_ind(group1, group2)
    d = _cohens_d(group1, group2)
    n1, n2 = len(group1), len(group2)
    df = n1 + n2 - 2
    mean_diff = float(np.mean(group1) - np.mean(group2))
    se = float(np.sqrt(np.var(group1, ddof=1) / n1 + np.var(group2, ddof=1) / n2))
    ci = scipy_stats.t.interval(0.95, df=df, loc=mean_diff, scale=se)
    return {
        "statistic": float(t),
        "p_value": float(p),
        "effect_size": d,
        "effect_label": _effect_label(d, "d"),
        "ci_95": [float(ci[0]), float(ci[1])],
        "df": df,
        "mean_difference": mean_diff,
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
