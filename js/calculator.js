/**
 * 대출 상환 계산 엔진
 * 4가지 한국 상환 방식 + 중도상환 시뮬레이션
 */

const Calculator = (() => {
    /**
     * 원리금균등상환 (Equal Principal and Interest)
     * 매달 동일한 금액(원금+이자) 납부
     */
    function equalPayment(principal, annualRate, years) {
        const months = years * 12;
        const monthlyRate = annualRate / 100 / 12;
        const schedule = [];

        if (monthlyRate === 0) {
            const payment = principal / months;
            let balance = principal;
            for (let m = 1; m <= months; m++) {
                balance -= payment;
                schedule.push({
                    month: m,
                    principal: payment,
                    interest: 0,
                    payment: payment,
                    balance: Math.max(0, balance),
                });
            }
            return schedule;
        }

        const monthlyPayment =
            (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
            (Math.pow(1 + monthlyRate, months) - 1);

        let balance = principal;

        for (let m = 1; m <= months; m++) {
            const interest = balance * monthlyRate;
            const principalPart = monthlyPayment - interest;
            balance -= principalPart;

            schedule.push({
                month: m,
                principal: principalPart,
                interest: interest,
                payment: monthlyPayment,
                balance: Math.max(0, balance),
            });
        }

        return schedule;
    }

    /**
     * 원금균등상환 (Equal Principal)
     * 매달 동일한 원금 + 잔여 이자 납부
     */
    function equalPrincipal(principal, annualRate, years) {
        const months = years * 12;
        const monthlyRate = annualRate / 100 / 12;
        const monthlyPrincipal = principal / months;
        const schedule = [];
        let balance = principal;

        for (let m = 1; m <= months; m++) {
            const interest = balance * monthlyRate;
            const payment = monthlyPrincipal + interest;
            balance -= monthlyPrincipal;

            schedule.push({
                month: m,
                principal: monthlyPrincipal,
                interest: interest,
                payment: payment,
                balance: Math.max(0, balance),
            });
        }

        return schedule;
    }

    /**
     * 만기일시상환 (Bullet Repayment)
     * 매달 이자만 납부, 만기에 원금 전액 상환
     */
    function bulletRepayment(principal, annualRate, years) {
        const months = years * 12;
        const monthlyRate = annualRate / 100 / 12;
        const monthlyInterest = principal * monthlyRate;
        const schedule = [];

        for (let m = 1; m <= months; m++) {
            const isLast = m === months;
            schedule.push({
                month: m,
                principal: isLast ? principal : 0,
                interest: monthlyInterest,
                payment: isLast ? principal + monthlyInterest : monthlyInterest,
                balance: isLast ? 0 : principal,
            });
        }

        return schedule;
    }

    /**
     * 거치식 + 원리금균등상환 (Grace Period + Equal Payment)
     * 거치 기간 동안 이자만 납부, 이후 원리금균등 상환
     */
    function graceEqualPayment(principal, annualRate, years, graceYears) {
        const totalMonths = years * 12;
        const graceMonths = graceYears * 12;
        const repayMonths = totalMonths - graceMonths;
        const monthlyRate = annualRate / 100 / 12;
        const schedule = [];

        if (repayMonths <= 0) {
            return bulletRepayment(principal, annualRate, years);
        }

        // 거치 기간: 이자만 납부
        const graceInterest = principal * monthlyRate;
        for (let m = 1; m <= graceMonths; m++) {
            schedule.push({
                month: m,
                principal: 0,
                interest: graceInterest,
                payment: graceInterest,
                balance: principal,
            });
        }

        // 상환 기간: 원리금균등
        let monthlyPayment;
        if (monthlyRate === 0) {
            monthlyPayment = principal / repayMonths;
        } else {
            monthlyPayment =
                (principal * monthlyRate * Math.pow(1 + monthlyRate, repayMonths)) /
                (Math.pow(1 + monthlyRate, repayMonths) - 1);
        }

        let balance = principal;
        for (let m = 1; m <= repayMonths; m++) {
            const interest = balance * monthlyRate;
            const principalPart = monthlyPayment - interest;
            balance -= principalPart;

            schedule.push({
                month: graceMonths + m,
                principal: principalPart,
                interest: interest,
                payment: monthlyPayment,
                balance: Math.max(0, balance),
            });
        }

        return schedule;
    }

    /**
     * 중도상환 시뮬레이션
     */
    function earlyRepayment(method, principal, annualRate, years, earlyMonth, earlyAmount, graceYears = 0) {
        const monthlyRate = annualRate / 100 / 12;
        const totalMonths = years * 12;
        const schedule = [];
        let balance = principal;

        let originalSchedule;
        switch (method) {
            case 'equalPayment':
                originalSchedule = equalPayment(principal, annualRate, years);
                break;
            case 'equalPrincipal':
                originalSchedule = equalPrincipal(principal, annualRate, years);
                break;
            case 'bullet':
                originalSchedule = bulletRepayment(principal, annualRate, years);
                break;
            case 'grace':
                originalSchedule = graceEqualPayment(principal, annualRate, years, graceYears);
                break;
            default:
                return [];
        }

        // 중도상환 전까지 원래 스케줄 사용
        for (let i = 0; i < Math.min(earlyMonth, originalSchedule.length); i++) {
            schedule.push({ ...originalSchedule[i] });
            balance = originalSchedule[i].balance;
        }

        // 중도상환 적용
        balance = Math.max(0, balance - earlyAmount);

        if (balance <= 0) {
            schedule[schedule.length - 1].balance = 0;
            return schedule;
        }

        // 잔여 기간 재계산 (원리금균등으로 전환)
        const remainingMonths = totalMonths - earlyMonth;
        if (remainingMonths <= 0) return schedule;

        let newPayment;
        if (monthlyRate === 0) {
            newPayment = balance / remainingMonths;
        } else {
            newPayment =
                (balance * monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)) /
                (Math.pow(1 + monthlyRate, remainingMonths) - 1);
        }

        for (let m = 1; m <= remainingMonths; m++) {
            const interest = balance * monthlyRate;
            const principalPart = newPayment - interest;
            balance -= principalPart;

            schedule.push({
                month: earlyMonth + m,
                principal: principalPart,
                interest: interest,
                payment: newPayment,
                balance: Math.max(0, balance),
            });
        }

        return schedule;
    }

    /**
     * 스케줄 요약 통계
     */
    function summarize(schedule) {
        if (!schedule || schedule.length === 0) {
            return { totalInterest: 0, totalPayment: 0, avgPayment: 0, maxPayment: 0, minPayment: 0, months: 0 };
        }
        const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
        const totalPayment = schedule.reduce((s, r) => s + r.payment, 0);
        const payments = schedule.map((r) => r.payment);
        return {
            totalInterest,
            totalPayment,
            avgPayment: totalPayment / schedule.length,
            maxPayment: Math.max(...payments),
            minPayment: Math.min(...payments),
            months: schedule.length,
        };
    }

    const METHOD_LABELS = {
        equalPayment: '원리금균등상환',
        equalPrincipal: '원금균등상환',
        bullet: '만기일시상환',
        grace: '거치식상환',
    };

    const METHOD_COLORS = {
        equalPayment: '#3b82f6',
        equalPrincipal: '#10b981',
        bullet: '#f59e0b',
        grace: '#ef4444',
    };

    function formatKRW(value) {
        if (value >= 10000) {
            const uk = Math.floor(value / 10000);
            const man = Math.round(value % 10000);
            return man > 0 ? `${uk}억 ${man.toLocaleString()}만원` : `${uk}억원`;
        }
        return Math.round(value).toLocaleString() + '만원';
    }

    function formatCompactKRW(value) {
        if (value >= 10000) {
            return (value / 10000).toFixed(1).replace(/\.0$/, '') + '억';
        }
        if (value >= 1000) {
            return (value / 1000).toFixed(0) + '천만'; // 천 -> 천만으로 수정해봄 (기존 chart.js 참고)
        }
        return Math.round(value).toLocaleString() + '만';
    }

    return {
        equalPayment,
        equalPrincipal,
        bulletRepayment,
        graceEqualPayment,
        earlyRepayment,
        summarize,
        formatKRW,
        formatCompactKRW,
        METHOD_LABELS,
        METHOD_COLORS,
    };
})();
