/**
 * 대출 상환 비교 플래너 — 앱 메인 로직
 */
const App = (() => {
    let results = {}; // { method: schedule[] }

    function init() {
        ChartManager.init();
        bindEvents();
        applyTheme();
    }

    // ─── 이벤트 바인딩 ───
    function bindEvents() {
        // 상환 방식 칩 토글
        document.querySelectorAll('.method-chip').forEach((chip) => {
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                const cb = chip.querySelector('input[type="checkbox"]');
                cb.checked = !cb.checked;
                chip.classList.toggle('active', cb.checked);

                // 거치식 선택 시 거치기간 입력 표시
                const graceOption = document.getElementById('graceOption');
                const graceChecked = document.querySelector('.method-chip[data-method="grace"] input').checked;
                graceOption.classList.toggle('hidden', !graceChecked);
            });
        });

        // 계산 버튼
        document.getElementById('btnCalculate').addEventListener('click', calculate);

        // 차트 탭
        document.querySelectorAll('.chart-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.chart-tab').forEach((t) => t.classList.remove('active'));
                tab.classList.add('active');
                ChartManager.render(tab.getAttribute('data-chart'));
            });
        });

        // 스케줄 테이블 방식 변경
        document.getElementById('scheduleMethodSelect').addEventListener('change', renderScheduleTable);

        // 중도상환 시뮬레이션
        document.getElementById('btnSimulate').addEventListener('click', simulateEarlyRepayment);

        // 테마 토글
        document.getElementById('themeToggle').addEventListener('click', toggleTheme);

        // Enter 키로 계산
        document.querySelectorAll('#input-section input').forEach((input) => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') calculate();
            });
        });
    }

    // ─── 메인 계산 ───
    function calculate() {
        const principal = parseFloat(document.getElementById('loanAmount').value); // 만원
        const rate = parseFloat(document.getElementById('interestRate').value);
        const years = parseInt(document.getElementById('loanPeriod').value);
        const graceYears = parseInt(document.getElementById('gracePeriod').value) || 2;

        if (!principal || rate === undefined || rate === null || isNaN(rate) || !years || principal <= 0 || rate < 0 || years <= 0) {
            alert('대출 정보를 올바르게 입력해주세요.');
            return;
        }

        if (graceYears >= years) {
            alert('거치 기간은 대출 기간보다 짧아야 합니다.');
            return;
        }

        // 선택된 상환 방식 수집
        const selectedMethods = [];
        document.querySelectorAll('.method-chip input:checked').forEach((cb) => {
            selectedMethods.push(cb.value);
        });

        if (selectedMethods.length === 0) {
            alert('비교할 상환 방식을 최소 1개 선택해주세요.');
            return;
        }

        results = {};

        selectedMethods.forEach((method) => {
            switch (method) {
                case 'equalPayment':
                    results[method] = Calculator.equalPayment(principal, rate, years);
                    break;
                case 'equalPrincipal':
                    results[method] = Calculator.equalPrincipal(principal, rate, years);
                    break;
                case 'bullet':
                    results[method] = Calculator.bulletRepayment(principal, rate, years);
                    break;
                case 'grace':
                    results[method] = Calculator.graceEqualPayment(principal, rate, years, graceYears);
                    break;
            }
        });

        // 결과 표시
        const resultsSection = document.getElementById('results-section');
        resultsSection.classList.add('visible');

        renderSummaryCards(selectedMethods);
        renderInterestBars(selectedMethods);
        populateDropdowns(selectedMethods);

        ChartManager.setResults(results);
        ChartManager.render('payment');
        document.querySelectorAll('.chart-tab').forEach((t) => t.classList.remove('active'));
        document.querySelector('.chart-tab[data-chart="payment"]').classList.add('active');

        renderScheduleTable();

        // 결과 섹션으로 스크롤
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ─── 요약 카드 렌더링 ───
    function renderSummaryCards(methods) {
        const grid = document.getElementById('summaryGrid');
        grid.innerHTML = '';

        // 최소 이자 방식 찾기
        let minInterest = Infinity;
        let minMethod = '';
        methods.forEach((m) => {
            const s = Calculator.summarize(results[m]);
            if (s.totalInterest < minInterest) {
                minInterest = s.totalInterest;
                minMethod = m;
            }
        });

        methods.forEach((method, idx) => {
            const summary = Calculator.summarize(results[method]);
            const color = Calculator.METHOD_COLORS[method];

            const card = document.createElement('div');
            card.className = 'summary-card';
            card.style.setProperty('--card-accent', color);
            card.style.cssText += `animation-delay: ${idx * 0.05}s;`;
            card.querySelector?.('::before')?.style?.setProperty?.('background', color);

            const bestBadge = method === minMethod && methods.length > 1 ? '<span class="best-label">최저</span>' : '';

            card.innerHTML = `
        <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:${color};border-radius:4px 0 0 4px;"></div>
        <div class="method-name">
          <span class="method-dot" style="background:${color};box-shadow:0 0 8px ${color}"></span>
          ${Calculator.METHOD_LABELS[method]}
        </div>
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-label">총 이자</span>
            <span class="stat-value interest">${formatMoney(summary.totalInterest)}${bestBadge}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">총 상환액</span>
            <span class="stat-value">${formatMoney(summary.totalPayment)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">월 평균 상환</span>
            <span class="stat-value highlight">${formatMoney(summary.avgPayment)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">월 최대 상환</span>
            <span class="stat-value">${formatMoney(summary.maxPayment)}</span>
          </div>
        </div>
      `;

            grid.appendChild(card);
        });

        // 숫자 애니메이션
        animateNumbers(grid);
    }

    // ─── 이자 비교 바 렌더링 ───
    function renderInterestBars(methods) {
        const container = document.getElementById('interestBars');
        container.innerHTML = '';

        const interests = methods.map((m) => ({
            method: m,
            interest: Calculator.summarize(results[m]).totalInterest,
        }));

        const maxInterest = Math.max(...interests.map((i) => i.interest));

        interests.forEach((item) => {
            const color = Calculator.METHOD_COLORS[item.method];
            const pct = maxInterest > 0 ? (item.interest / maxInterest) * 100 : 0;

            const barItem = document.createElement('div');
            barItem.className = 'interest-bar-item';
            barItem.innerHTML = `
        <span class="interest-bar-label">${Calculator.METHOD_LABELS[item.method]}</span>
        <div class="interest-bar-track">
          <div class="interest-bar-fill" style="background:${color};width:0%"></div>
        </div>
        <span class="interest-bar-amount">${formatMoney(item.interest)}</span>
      `;

            container.appendChild(barItem);

            // 바 애니메이션
            requestAnimationFrame(() => {
                setTimeout(() => {
                    barItem.querySelector('.interest-bar-fill').style.width = pct + '%';
                }, 100);
            });
        });
    }

    // ─── 드롭다운 채우기 ───
    function populateDropdowns(methods) {
        const scheduleSelect = document.getElementById('scheduleMethodSelect');
        const earlySelect = document.getElementById('earlyMethod');

        [scheduleSelect, earlySelect].forEach((sel) => {
            sel.innerHTML = '';
            methods.forEach((m) => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = Calculator.METHOD_LABELS[m];
                sel.appendChild(opt);
            });
        });
    }

    // ─── 스케줄 테이블 렌더링 ───
    function renderScheduleTable() {
        const method = document.getElementById('scheduleMethodSelect').value;
        const schedule = results[method];
        const tbody = document.getElementById('scheduleBody');

        if (!schedule) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted)">상환 방식을 선택하세요</td></tr>';
            return;
        }

        tbody.innerHTML = '';

        // 기간이 길면 연 단위로 표시 옵션
        const showAll = schedule.length <= 120;

        schedule.forEach((row, i) => {
            // 120개월 이상이면 12개월마다 + 마지막만
            if (!showAll && i % 12 !== 0 && i !== schedule.length - 1) return;

            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${row.month}회</td>
        <td>${formatWon(row.payment)}</td>
        <td>${formatWon(row.principal)}</td>
        <td>${formatWon(row.interest)}</td>
        <td>${formatWon(row.balance)}</td>
      `;

            tbody.appendChild(tr);
        });
    }

    // ─── 중도상환 시뮬레이션 ───

    function simulateEarlyRepayment() {
        const method = document.getElementById('earlyMethod').value;
        const earlyMonth = parseInt(document.getElementById('earlyMonth').value);
        const earlyAmount = parseFloat(document.getElementById('earlyAmount').value);

        const principal = parseFloat(document.getElementById('loanAmount').value);
        const rate = parseFloat(document.getElementById('interestRate').value);
        const years = parseInt(document.getElementById('loanPeriod').value);
        const graceYears = parseInt(document.getElementById('gracePeriod').value) || 2;

        if (!earlyMonth || !earlyAmount || earlyMonth < 1 || earlyAmount <= 0) {
            alert('중도상환 정보를 올바르게 입력해주세요.');
            return;
        }

        const totalMonths = years * 12;
        if (earlyMonth >= totalMonths) {
            alert('중도상환 시점은 대출 기간 내여야 합니다.');
            return;
        }

        // 원래 스케줄
        const originalSchedule = results[method];
        const originalSummary = Calculator.summarize(originalSchedule);

        // 중도상환 스케줄
        const earlySchedule = Calculator.earlyRepayment(method, principal, rate, years, earlyMonth, earlyAmount, graceYears);
        const earlySummary = Calculator.summarize(earlySchedule);

        const savedInterest = originalSummary.totalInterest - earlySummary.totalInterest;
        const savedMonths = originalSummary.months - earlySummary.months;

        const resultDiv = document.getElementById('earlyResult');
        const compDiv = document.getElementById('earlyComparison');

        compDiv.innerHTML = `
      <div class="early-stat">
        <span class="label">기존 총이자</span>
        <span class="value">${formatMoney(originalSummary.totalInterest)}</span>
      </div>
      <div class="early-stat">
        <span class="label">중도상환 후 총이자</span>
        <span class="value">${formatMoney(earlySummary.totalInterest)}</span>
      </div>
      <div class="early-stat">
        <span class="label">절약 이자</span>
        <span class="value saved">▼ ${formatMoney(savedInterest)}</span>
      </div>
      <div class="early-stat">
        <span class="label">단축 기간</span>
        <span class="value saved">${savedMonths > 0 ? `▼ ${savedMonths}개월` : '-'}</span>
      </div>
    `;

        resultDiv.classList.add('visible');
    }

    // ─── 테마 ───
    function toggleTheme() {
        const html = document.documentElement;
        const current = html.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('debt-theme', next);
        updateThemeIcon(next);
        ChartManager.refresh();
    }

    function applyTheme() {
        const saved = localStorage.getItem('debt-theme') || 'dark';
        document.documentElement.setAttribute('data-theme', saved);
        updateThemeIcon(saved);
    }

    function updateThemeIcon(theme) {
        document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    // ─── 유틸리티 ───
    function formatWon(value) {
        if (value === undefined || value === null || isNaN(value)) return '0원';
        // 만원 단위를 원 단위로 변환 (10,000 곱함) 후 반올림
        return Math.round(value * 10000).toLocaleString('ko-KR') + '원';
    }

    function formatMoney(value) {
        if (value === undefined || value === null || isNaN(value)) return '0원';
        if (Math.abs(value) >= 10000) {
            const eok = Math.floor(value / 10000);
            const man = Math.round(value % 10000);
            if (man === 0) return `${eok.toLocaleString('ko-KR')}억원`;
            return `${eok}억 ${man.toLocaleString('ko-KR')}만원`;
        }
        return Math.round(value).toLocaleString('ko-KR') + '만원';
    }

    function animateNumbers(container) {
        container.querySelectorAll('.stat-value').forEach((el) => {
            const text = el.textContent;
            // 그냥 페이드인 애니메이션으로 처리
            el.style.opacity = '0';
            el.style.transform = 'translateY(6px)';
            el.style.transition = 'all 0.4s ease';
            requestAnimationFrame(() => {
                setTimeout(() => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }, 50);
            });
        });
    }

    // DOM 준비 후 초기화
    document.addEventListener('DOMContentLoaded', init);

    return { calculate };
})();
