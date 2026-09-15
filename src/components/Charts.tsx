import React, { useState } from "react";
import { money } from "../data";

interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

const IOS_COLORS = [
  "#38bdf8", // Sky
  "#818cf8", // Indigo
  "#c084fc", // Purple
  "#f472b6", // Pink
  "#fb7185", // Rose
  "#fb923c", // Orange
  "#facc15", // Amber
  "#34d399", // Emerald
  "#2dd4bf", // Teal
  "#60a5fa", // Blue
  "#a78bfa", // Violet
  "#94a3b8", // Slate
];

interface DonutChartProps {
  data: { category: string; amount: number }[];
  totalExpense: number;
}

export const CategoryDonutChart: React.FC<DonutChartProps> = ({ data, totalExpense }) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | null>(null);

  if (!totalExpense || data.length === 0) {
    return (
      <div className="chart-empty-state">
        <p className="empty">Tus categorías y gráfica aparecerán al registrar tu primer gasto.</p>
      </div>
    );
  }

  // Prepara datos con porcentajes y colores
  const categories: CategoryData[] = data.map((item, index) => ({
    category: item.category,
    amount: item.amount,
    percentage: Math.round((item.amount / totalExpense) * 100),
    color: IOS_COLORS[index % IOS_COLORS.length],
  }));

  const radius = 70;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercentage = 0;

  const displayItem = selectedCategory || {
    category: "Total gastos",
    amount: totalExpense,
    percentage: 100,
    color: "#f8fafc",
  };

  return (
    <div className="ios-donut-container">
      <div className="donut-graphic-wrapper">
        <svg
          viewBox="0 0 200 200"
          className="donut-svg"
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Fondo sutil del anillo */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth}
          />
          {categories.map((item) => {
            const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
            const strokeDashoffset = -((cumulativePercentage / 100) * circumference);
            cumulativePercentage += item.percentage;
            const isSelected = selectedCategory?.category === item.category;

            return (
              <circle
                key={item.category}
                cx="100"
                cy="100"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={isSelected ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="donut-segment"
                style={{
                  cursor: "pointer",
                  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  filter: isSelected ? `drop-shadow(0 0 8px ${item.color}80)` : "none",
                  opacity: selectedCategory && !isSelected ? 0.45 : 1,
                }}
                onClick={() =>
                  setSelectedCategory(isSelected ? null : item)
                }
              />
            );
          })}
        </svg>

        {/* Centro del donut informativo */}
        <div
          className="donut-center-info"
          onClick={() => setSelectedCategory(null)}
          style={{ cursor: selectedCategory ? "pointer" : "default" }}
        >
          <span className="donut-center-label" style={{ color: selectedCategory ? displayItem.color : "var(--muted, #94a3b8)" }}>
            {displayItem.category}
          </span>
          <strong className="donut-center-amount">
            {money(displayItem.amount)}
          </strong>
          {selectedCategory && (
            <span className="donut-center-sub">
              {displayItem.percentage}% del total
            </span>
          )}
        </div>
      </div>

      {/* Lista interactiva de categorías con barra de progreso */}
      <div className="donut-legend-list">
        {categories.map((item) => {
          const isSelected = selectedCategory?.category === item.category;
          return (
            <div
              key={item.category}
              className={`donut-legend-item ${isSelected ? "active" : ""}`}
              onClick={() => setSelectedCategory(isSelected ? null : item)}
              style={{
                cursor: "pointer",
                background: isSelected ? "rgba(255, 255, 255, 0.08)" : "transparent",
                borderRadius: "12px",
                padding: "8px 12px",
                transition: "all 0.2s ease",
              }}
            >
              <div className="legend-item-head">
                <div className="legend-label-group">
                  <span
                    className="legend-bullet"
                    style={{
                      backgroundColor: item.color,
                      boxShadow: isSelected ? `0 0 8px ${item.color}` : "none",
                    }}
                  />
                  <span className="legend-name">{item.category}</span>
                </div>
                <div className="legend-amount-group">
                  <strong className="legend-amount">{money(item.amount)}</strong>
                  <span className="legend-pct">{item.percentage}%</span>
                </div>
              </div>
              <div className="legend-progress-bg">
                <div
                  className="legend-progress-fill"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: item.color,
                    transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface IncomeExpenseFlowProps {
  income: number;
  expense: number;
}

export const IncomeExpenseFlow: React.FC<IncomeExpenseFlowProps> = ({ income, expense }) => {
  const total = income + expense;
  if (total === 0) return null;

  const incomePct = total > 0 ? Math.round((income / total) * 100) : 0;
  const expensePct = total > 0 ? Math.round((expense / total) * 100) : 0;
  const savings = Math.max(0, income - expense);
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

  return (
    <div className="flow-card">
      <div className="flow-header">
        <h3>Flujo del mes</h3>
        {income > expense && (
          <span className="savings-badge positive">
            +{savingsRate}% ahorro
          </span>
        )}
      </div>

      <div className="flow-bar-container">
        <div
          className="flow-bar-segment income-bar"
          style={{ width: `${incomePct}%` }}
          title={`Ingresos: ${money(income)} (${incomePct}%)`}
        />
        <div
          className="flow-bar-segment expense-bar"
          style={{ width: `${expensePct}%` }}
          title={`Gastos: ${money(expense)} (${expensePct}%)`}
        />
      </div>

      <div className="flow-legend">
        <div className="flow-legend-col">
          <span className="flow-legend-dot income-dot" />
          <span>Ingresos: <strong>{money(income)}</strong> ({incomePct}%)</span>
        </div>
        <div className="flow-legend-col">
          <span className="flow-legend-dot expense-dot" />
          <span>Gastos: <strong>{money(expense)}</strong> ({expensePct}%)</span>
        </div>
      </div>
    </div>
  );
};
