"""Estimate how many voters chose each (race A, race B) pair from per-section totals.

The RDV sorts each race's ballots independently, so the joint table is never observed.
We combine exact per-section bounds with an entropy-maximizing ecological inference estimate
(global transfer matrix by constrained regression, then raked to each section's margins).
"""
import numpy as np
import pandas as pd
from scipy.optimize import minimize

SECTION_KEY = ["CD_MUNICIPIO", "NR_ZONA", "NR_SECAO"]
MISSING = "NÃO VOTOU NO CARGO"


def section_matrix(rows: pd.DataFrame, labels: dict[int, str], other_label: str = "OUTROS") -> pd.DataFrame:
    """Pivot one race's rows into a sections x categories count matrix."""
    category = rows.NR_VOTAVEL.map(labels).fillna(other_label)
    return rows.assign(category=category).pivot_table(
        index=SECTION_KEY, columns="category", values="QT_VOTOS", aggfunc="sum", fill_value=0
    )


def align(race_a: pd.DataFrame, race_b: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Give both races the same sections and equal per-section totals.

    A voter in transit from another state votes only for President, so race B gets a
    MISSING column for the gap. A negative gap would mean the data is inconsistent.
    """
    race_a, race_b = race_a.align(race_b, join="outer", axis=0, fill_value=0)
    gap = race_a.sum(axis=1) - race_b.sum(axis=1)
    if (gap < 0).any():
        raise ValueError(f"{int((gap < 0).sum())} sections have more votes in race B than in race A")
    if gap.any():
        race_b = race_b.assign(**{MISSING: gap})
    return race_a, race_b


def frechet_bounds(x: np.ndarray, g: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Sum over sections of the tightest bounds on each joint cell given only the margins."""
    voters = x.sum(axis=1)
    lower = np.maximum(0, x[:, :, None] + g[:, None, :] - voters[:, None, None]).sum(axis=0)
    upper = np.minimum(x[:, :, None], g[:, None, :]).sum(axis=0)
    return lower, upper


def transfer_matrix(x: np.ndarray, g: np.ndarray) -> np.ndarray:
    """Row-stochastic P minimizing sum_s n_s ||g_s/n_s - (x_s/n_s) P||^2 (constrained ecological regression)."""
    rows, cols = x.shape[1], g.shape[1]
    # Weighting shares by n_s equals dividing counts by sqrt(n_s). Dividing by the total keeps the
    # objective near 1: in raw counts it is ~1e9 and SLSQP reports success without moving.
    weight = 1 / np.sqrt(x.sum(axis=1, keepdims=True).clip(1))
    xw, gw = x * weight, g * weight
    xtx, xtg = xw.T @ xw / x.sum(), xw.T @ gw / x.sum()

    def objective(flat):
        p = flat.reshape(rows, cols)
        return np.trace(p.T @ xtx @ p) - 2 * np.trace(p.T @ xtg)

    def gradient(flat):
        p = flat.reshape(rows, cols)
        return (2 * xtx @ p - 2 * xtg).ravel()

    row_sums = [{"type": "eq", "fun": lambda flat, r=r: flat.reshape(rows, cols)[r].sum() - 1} for r in range(rows)]
    start = np.tile(g.sum(axis=0) / g.sum(), (rows, 1)).ravel()
    result = minimize(objective, start, jac=gradient, method="SLSQP", bounds=[(0, 1)] * rows * cols,
                      constraints=row_sums, options={"maxiter": 1000, "ftol": 1e-14})
    if not result.success:
        raise RuntimeError(f"transfer matrix did not converge: {result.message}")
    return result.x.reshape(rows, cols)


def rake(seed: np.ndarray, x: np.ndarray, g: np.ndarray, iterations: int = 200) -> np.ndarray:
    """Iterative proportional fitting of every section's seed table to its exact margins."""
    table = seed.copy() + 1e-9  # keeps structural zeros from stalling the fit
    for _ in range(iterations):
        table *= (x / table.sum(axis=2).clip(1e-12))[:, :, None]
        table *= (g / table.sum(axis=1).clip(1e-12))[:, None, :]
    return table


def crosstab(race_a: pd.DataFrame, race_b: pd.DataFrame, group_level: str | None = "CD_MUNICIPIO",
             shrinkage_sections: int = 30) -> pd.DataFrame:
    """Joint estimate with bounds. A per-group fit absorbs regional differences in behavior,
    which a single state-wide fit misreads as association. Small groups shrink toward the state fit."""
    race_a, race_b = align(race_a, race_b)
    x, g = race_a.to_numpy(float), race_b.to_numpy(float)
    lower, upper = frechet_bounds(x, g)
    p = transfer_matrix(x, g)
    if group_level is None:
        estimate = rake(x[:, :, None] * p[None, :, :], x, g).sum(axis=0)
    else:
        groups = race_a.index.get_level_values(group_level).to_numpy()
        estimate = np.zeros((x.shape[1], g.shape[1]))
        for group in np.unique(groups):
            mask = groups == group
            weight = mask.sum() / (mask.sum() + shrinkage_sections)
            local_p = weight * transfer_matrix(x[mask], g[mask]) + (1 - weight) * p
            estimate += rake(x[mask][:, :, None] * local_p[None, :, :], x[mask], g[mask]).sum(axis=0)
    cells = []
    for i, label_a in enumerate(race_a.columns):
        for j, label_b in enumerate(race_b.columns):
            cells.append({"a": label_a, "b": label_b, "estimate": estimate[i, j],
                          "lower": lower[i, j], "upper": upper[i, j], "global_rate": p[i, j]})
    return pd.DataFrame(cells)
