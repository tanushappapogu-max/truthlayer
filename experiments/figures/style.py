"""Shared matplotlib style for all paper figures."""

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt


def apply():
    plt.rcParams.update({
        "font.family": ["Helvetica Neue", "Arial", "DejaVu Sans"],
        "font.size": 10,
        "axes.titlesize": 12,
        "axes.titleweight": "semibold",
        "axes.titlepad": 12,
        "axes.labelsize": 10.5,
        "axes.edgecolor": "#444444",
        "axes.linewidth": 0.8,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "xtick.color": "#444444",
        "ytick.color": "#444444",
        "text.color": "#222222",
        "axes.labelcolor": "#222222",
        "grid.color": "#000000",
        "grid.alpha": 0.08,
        "figure.facecolor": "white",
        "savefig.facecolor": "white",
        "savefig.bbox": "tight",
    })
