/**
 * Chart.js 기반 차트 렌더링 모듈
 */
const ChartManager = (() => {
    let mainChart = null;
    let currentType = 'payment';
    let cachedResults = {};

    function init() {
        // Chart.js 기본 설정
        Chart.defaults.font.family = "'Noto Sans KR', sans-serif";
        Chart.defaults.font.size = 12;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
        Chart.defaults.plugins.tooltip.padding = 10;
    }

    function getThemeColors() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            gridColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            textColor: isDark ? '#94a3b8' : '#555770',
            bgColor: isDark ? 'rgba(26,35,50,0.85)' : 'rgba(255,255,255,0.85)',
        };
    }

    function setResults(results) {
        cachedResults = results;
    }

    /**
     * 월별 상환액 추이 차트
     */
    function renderPaymentChart(ctx) {
        const theme = getThemeColors();
        const datasets = [];

        for (const [method, schedule] of Object.entries(cachedResults)) {
            const color = Calculator.METHOD_COLORS[method];
            // 대출 기간이 길면 연 단위로 샘플링
            const sampled = sampleData(schedule, 'payment');
            datasets.push({
                label: Calculator.METHOD_LABELS[method],
                data: sampled.values,
                borderColor: color,
                backgroundColor: hexToRgba(color, 0.08),
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.3,
                fill: true,
            });
        }

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: sampleLabels(Object.values(cachedResults)[0]),
                datasets,
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: theme.textColor, usePointStyle: true, pointStyle: 'circle', padding: 15 },
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${formatKRW(ctx.parsed.y)}`,
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { color: theme.gridColor },
                        ticks: { color: theme.textColor, maxTicksLimit: 15 },
                    },
                    y: {
                        grid: { color: theme.gridColor },
                        ticks: {
                            color: theme.textColor,
                            callback: (v) => formatCompactKRW(v),
                        },
                    },
                },
                animation: { duration: 800, easing: 'easeInOutQuart' },
            },
        });
    }

    /**
     * 대출 잔액 변화 차트
     */
    function renderBalanceChart(ctx) {
        const theme = getThemeColors();
        const datasets = [];

        for (const [method, schedule] of Object.entries(cachedResults)) {
            const color = Calculator.METHOD_COLORS[method];
            const sampled = sampleData(schedule, 'balance');
            datasets.push({
                label: Calculator.METHOD_LABELS[method],
                data: sampled.values,
                borderColor: color,
                backgroundColor: hexToRgba(color, 0.06),
                borderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.2,
                fill: true,
            });
        }

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: sampleLabels(Object.values(cachedResults)[0]),
                datasets,
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: theme.textColor, usePointStyle: true, pointStyle: 'circle', padding: 15 },
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${formatKRW(ctx.parsed.y)}`,
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { color: theme.gridColor },
                        ticks: { color: theme.textColor, maxTicksLimit: 15 },
                    },
                    y: {
                        grid: { color: theme.gridColor },
                        ticks: {
                            color: theme.textColor,
                            callback: (v) => formatCompactKRW(v),
                        },
                    },
                },
                animation: { duration: 800, easing: 'easeInOutQuart' },
            },
        });
    }

    /**
     * 이자 비중 변화 차트 (상환액 중 이자 비율)
     */
    function renderInterestRatioChart(ctx) {
        const theme = getThemeColors();
        const datasets = [];

        for (const [method, schedule] of Object.entries(cachedResults)) {
            const color = Calculator.METHOD_COLORS[method];
            const sampled = sampleDataCustom(schedule, (row) =>
                row.payment > 0 ? (row.interest / row.payment) * 100 : 0
            );
            datasets.push({
                label: Calculator.METHOD_LABELS[method],
                data: sampled,
                borderColor: color,
                backgroundColor: hexToRgba(color, 0.06),
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.3,
                fill: true,
            });
        }

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: sampleLabels(Object.values(cachedResults)[0]),
                datasets,
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: theme.textColor, usePointStyle: true, pointStyle: 'circle', padding: 15 },
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { color: theme.gridColor },
                        ticks: { color: theme.textColor, maxTicksLimit: 15 },
                    },
                    y: {
                        grid: { color: theme.gridColor },
                        ticks: {
                            color: theme.textColor,
                            callback: (v) => v + '%',
                        },
                        min: 0,
                        max: 100,
                    },
                },
                animation: { duration: 800, easing: 'easeInOutQuart' },
            },
        });
    }

    /**
     * 차트 렌더링 (타입별 분기)
     */
    function render(type) {
        currentType = type || currentType;

        if (mainChart) {
            mainChart.destroy();
            mainChart = null;
        }

        const canvas = document.getElementById('mainChart');
        const ctx = canvas.getContext('2d');

        switch (currentType) {
            case 'payment':
                mainChart = renderPaymentChart(ctx);
                break;
            case 'balance':
                mainChart = renderBalanceChart(ctx);
                break;
            case 'interest':
                mainChart = renderInterestRatioChart(ctx);
                break;
        }
    }

    /**
     * 테마 변경 시 차트 재렌더링
     */
    function refresh() {
        if (Object.keys(cachedResults).length > 0) {
            render(currentType);
        }
    }

    // ─── 헬퍼 함수 ───

    function sampleData(schedule, key) {
        if (!schedule || schedule.length === 0) return { values: [] };
        const step = schedule.length > 120 ? 12 : schedule.length > 60 ? 6 : 1;
        const values = [];
        for (let i = 0; i < schedule.length; i += step) {
            values.push(schedule[i][key]);
        }
        // 마지막 값 포함
        if ((schedule.length - 1) % step !== 0) {
            values.push(schedule[schedule.length - 1][key]);
        }
        return { values };
    }

    function sampleDataCustom(schedule, fn) {
        if (!schedule || schedule.length === 0) return [];
        const step = schedule.length > 120 ? 12 : schedule.length > 60 ? 6 : 1;
        const values = [];
        for (let i = 0; i < schedule.length; i += step) {
            values.push(fn(schedule[i]));
        }
        if ((schedule.length - 1) % step !== 0) {
            values.push(fn(schedule[schedule.length - 1]));
        }
        return values;
    }

    function sampleLabels(schedule) {
        if (!schedule || schedule.length === 0) return [];
        const step = schedule.length > 120 ? 12 : schedule.length > 60 ? 6 : 1;
        const labels = [];
        for (let i = 0; i < schedule.length; i += step) {
            labels.push(formatMonthLabel(schedule[i].month, step));
        }
        if ((schedule.length - 1) % step !== 0) {
            labels.push(formatMonthLabel(schedule[schedule.length - 1].month, step));
        }
        return labels;
    }

    function formatMonthLabel(month, step) {
        if (step >= 12) {
            return Math.ceil(month / 12) + '년';
        }
        return month + '개월';
    }

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    function formatKRW(value) {
        if (value >= 10000) {
            return (value / 10000).toFixed(1) + '억원';
        }
        return Math.round(value).toLocaleString('ko-KR') + '만원';
    }

    function formatCompactKRW(value) {
        if (value >= 10000) {
            return (value / 10000).toFixed(0) + '억';
        }
        if (value >= 1000) {
            return (value / 1000).toFixed(0) + '천만';
        }
        return Math.round(value).toLocaleString('ko-KR') + '만';
    }

    return { init, setResults, render, refresh };
})();
