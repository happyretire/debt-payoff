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

    // ─── 공통 로직 ───

    function createDatasets(accessor) {
        const datasets = [];
        for (const [method, schedule] of Object.entries(cachedResults)) {
            const color = Calculator.METHOD_COLORS[method];
            const sampled = sampleData(schedule, accessor);
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
        return datasets;
    }

    function renderBaseChart(ctx, datasets, scaleOptions, tooltipFormatter) {
        const theme = getThemeColors();
        const labels = sampleLabels(Object.values(cachedResults)[0]);

        return new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
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
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                return `${label}: ${tooltipFormatter(value)}`;
                            },
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
                        ticks: { color: theme.textColor, ...scaleOptions.ticks },
                        ...scaleOptions, // max, min 등 오버라이드
                    },
                },
                animation: { duration: 800, easing: 'easeInOutQuart' },
            },
        });
    }

    // ─── 차트별 렌더링 ───

    function renderPaymentChart(ctx) {
        const datasets = createDatasets('payment');

        let yMax = undefined;
        if (window.isClipped) {
            yMax = calculateSmartLimit();
        }

        return renderBaseChart(
            ctx,
            datasets,
            {
                max: yMax,
                ticks: { callback: (v) => Calculator.formatCompactKRW(v) }
            },
            (v) => Calculator.formatKRW(v)
        );
    }

    function renderBalanceChart(ctx) {
        const datasets = createDatasets('balance');
        return renderBaseChart(
            ctx,
            datasets,
            {
                ticks: { callback: (v) => Calculator.formatCompactKRW(v) }
            },
            (v) => Calculator.formatKRW(v)
        );
    }

    function renderInterestRatioChart(ctx) {
        const datasets = createDatasets((row) =>
            row.payment > 0 ? (row.interest / row.payment) * 100 : 0
        );
        return renderBaseChart(
            ctx,
            datasets,
            {
                min: 0,
                max: 100,
                ticks: { callback: (v) => v + '%' }
            },
            (v) => v.toFixed(1) + '%'
        );
    }

    // ─── 메인 함수 ───

    function render(type, isClipped = false) {
        currentType = type || currentType;
        window.isClipped = isClipped;

        if (mainChart) {
            mainChart.destroy();
            mainChart = null;
        }

        const canvas = document.getElementById('mainChart');
        if (!canvas) return;
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

    function refresh() {
        if (Object.keys(cachedResults).length > 0) {
            render(currentType, window.isClipped); // isClipped 상태 유지
        }
    }

    // ─── 헬퍼 함수 ───

    function calculateSmartLimit() {
        let allValues = [];
        for (const schedule of Object.values(cachedResults)) {
            allValues = allValues.concat(schedule.map(row => row.payment));
        }

        if (allValues.length === 0) return undefined;

        allValues.sort((a, b) => b - a);
        const maxVal = allValues[0];
        const cutoffIndex = Math.max(1, Math.floor(allValues.length * 0.05));
        const cutoffVal = allValues[cutoffIndex];

        if (maxVal > cutoffVal * 2) {
            return cutoffVal * 1.3;
        }
        return undefined;
    }

    function sampleData(schedule, accessor) {
        if (!schedule || schedule.length === 0) return { values: [] };
        const step = schedule.length > 120 ? 12 : schedule.length > 60 ? 6 : 1;
        const values = [];

        const getValue = typeof accessor === 'function'
            ? accessor
            : (row) => row[accessor];

        for (let i = 0; i < schedule.length; i += step) {
            values.push(getValue(schedule[i]));
        }
        if ((schedule.length - 1) % step !== 0) {
            values.push(getValue(schedule[schedule.length - 1]));
        }
        return { values };
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

    return { init, setResults, render, refresh };
})();
