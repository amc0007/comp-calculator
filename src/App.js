import React, { useState, useMemo } from "react";
import { Calculator, Euro, TrendingUp, Calendar } from "lucide-react";

import "./tailwind.output.css";

const PolishTaxCalculator = () => {
  const [monthlyData, setMonthlyData] = useState(
    Array(12)
      .fill()
      .map(() => ({
        base: 0,
        cashLTI: 0,
        onCall: 0,
        bonus: 0,
      }))
  );
  const [allMonthsBase, setAllMonthsBase] = useState("");

  // 2025 Polish tax constants
  const TAX_BRACKETS = {
    first: { limit: 120000, rate: 0.12 }, // 12% up to 120,000 PLN
    second: { rate: 0.32 }, // 32% above 120,000 PLN
  };

  const ZUS_RATES = {
    pension: 0.0976, // 9.76%
    disability: 0.015, // 1.5%
    sickness: 0.0245, // 2.45%
    total: 0.1371, // 13.71% total employee contribution
  };

  const HEALTH_INSURANCE_RATE = 0.09; // 9% health insurance
  const HEALTH_INSURANCE_MIN_2025 = 314.96; // Minimum monthly health insurance
  const TAX_REDUCTION_MONTHLY = 300; // Monthly tax reduction (kwota zmniejszająca podatek)

  const ZUS_LIMIT_2025 = 260190; // Annual ZUS limit for 2025
  const AKUP_LIMIT_2025 = 120000; // Annual AKUP limit for 2025
  const AKUP_RATE = 0.5; // 50% deduction rate for copyright income

  const updateMonthData = (monthIndex, field, value) => {
    const newData = [...monthlyData];
    newData[monthIndex] = {
      ...newData[monthIndex],
      [field]: parseFloat(value) || 0,
    };
    setMonthlyData(newData);
  };

  const setAllBaseSalaries = (value) => {
    setAllMonthsBase(value);
    const baseValue = parseFloat(value) || 0;
    const newData = monthlyData.map((month) => ({
      ...month,
      base: baseValue,
    }));
    setMonthlyData(newData);
  };

  const calculations = useMemo(() => {
    let cumulativeTaxableIncome = 0;
    let cumulativeZUSBase = 0;
    let cumulativeAKUP = 0;
    let cumulativeTax = 0;

    return monthlyData.map((month, index) => {
      const { base, cashLTI, onCall, bonus } = month;
      const totalGross = base + cashLTI + onCall + bonus;

      // ZUS calculation - break down into components
      const zusBaseIncome = base + cashLTI + onCall + bonus; // Include bonus for ZUS
      const zusBase = Math.min(
        zusBaseIncome,
        Math.max(0, ZUS_LIMIT_2025 - cumulativeZUSBase)
      );

      // Pension and disability have annual limits, sickness does not
      const pensionBase = Math.min(
        zusBaseIncome,
        Math.max(0, ZUS_LIMIT_2025 - cumulativeZUSBase)
      );
      const disabilityBase = Math.min(
        zusBaseIncome,
        Math.max(0, ZUS_LIMIT_2025 - cumulativeZUSBase)
      );
      const sicknessBase = zusBaseIncome; // No annual limit for sickness contribution

      const pensionContrib = pensionBase * ZUS_RATES.pension; // 9.76%
      const disabilityContrib = disabilityBase * ZUS_RATES.disability; // 1.5%
      const sicknessContrib = sicknessBase * ZUS_RATES.sickness; // 2.45% - no limit
      const totalZusContrib =
        pensionContrib + disabilityContrib + sicknessContrib;

      cumulativeZUSBase += zusBase; // Only pension and disability count towards limit

      // Health insurance calculation for employees: 9% of (salary - ZUS contributions)
      const healthInsuranceBase = totalGross - totalZusContrib;
      const healthInsurance = Math.max(
        healthInsuranceBase * HEALTH_INSURANCE_RATE,
        HEALTH_INSURANCE_MIN_2025
      );

      // AKUP calculation (on 80% of base salary only AFTER its portion of ZUS deduction)
      const baseZUSPortion =
        base > 0 && zusBaseIncome > 0
          ? (base / zusBaseIncome) * totalZusContrib
          : 0;
      const baseAfterZUS = base - baseZUSPortion;
      const akupEligibleBase = baseAfterZUS * 0.8; // 80% of base salary after ZUS, bonus doesn't qualify
      const akupForMonth = Math.min(
        akupEligibleBase * AKUP_RATE,
        Math.max(0, AKUP_LIMIT_2025 - cumulativeAKUP)
      );
      cumulativeAKUP += akupForMonth;

      // Taxable income calculation (health insurance NOT deductible for employees on tax scale)
      const taxableIncome = totalGross - totalZusContrib - akupForMonth;
      cumulativeTaxableIncome += Math.max(0, taxableIncome);

      // Tax calculation
      let taxForMonth = 0;
      if (cumulativeTaxableIncome <= TAX_BRACKETS.first.limit) {
        const taxableThisMonth = Math.max(0, taxableIncome);
        taxForMonth = taxableThisMonth * TAX_BRACKETS.first.rate;
      } else {
        const previousCumulative =
          cumulativeTaxableIncome - Math.max(0, taxableIncome);
        if (previousCumulative >= TAX_BRACKETS.first.limit) {
          // All income this month is in second bracket
          taxForMonth = Math.max(0, taxableIncome) * TAX_BRACKETS.second.rate;
        } else {
          // Income spans both brackets
          const firstBracketAmount =
            TAX_BRACKETS.first.limit - previousCumulative;
          const secondBracketAmount =
            Math.max(0, taxableIncome) - firstBracketAmount;
          taxForMonth =
            firstBracketAmount * TAX_BRACKETS.first.rate +
            Math.max(0, secondBracketAmount) * TAX_BRACKETS.second.rate;
        }
      }

      cumulativeTax += taxForMonth;

      // Apply monthly tax reduction (kwota zmniejszająca podatek)
      const taxAfterReduction = Math.max(
        0,
        taxForMonth - TAX_REDUCTION_MONTHLY
      );

      // Net calculation
      const netIncome =
        totalGross - totalZusContrib - healthInsurance - taxAfterReduction;

      return {
        month: index + 1,
        totalGross,
        base,
        cashLTI,
        onCall,
        bonus,
        zusBase: pensionBase, // For display (pension and disability use same base)
        pensionBase,
        disabilityBase,
        sicknessBase,
        pensionContrib,
        disabilityContrib,
        sicknessContrib,
        totalZusContrib,
        healthInsuranceBase,
        healthInsurance,
        akupEligibleBase: akupEligibleBase,
        akupForMonth,
        taxableIncome: Math.max(0, taxableIncome),
        taxBeforeReduction: taxForMonth,
        taxReduction: TAX_REDUCTION_MONTHLY,
        taxForMonth: taxAfterReduction,
        netIncome,
        cumulativeTaxableIncome,
        cumulativeZUSBase,
        cumulativeAKUP,
        cumulativeTax,
        // Limits remaining
        taxBracket1Remaining: Math.max(
          0,
          TAX_BRACKETS.first.limit - cumulativeTaxableIncome
        ),
        zusLimitRemaining: Math.max(0, ZUS_LIMIT_2025 - cumulativeZUSBase),
        akupLimitRemaining: Math.max(0, AKUP_LIMIT_2025 - cumulativeAKUP),
      };
    });
  }, [monthlyData]);

  const yearlyTotals = useMemo(() => {
    return calculations.reduce(
      (totals, month) => ({
        totalGross: totals.totalGross + month.totalGross,
        totalZusContrib: totals.totalZusContrib + month.totalZusContrib,
        healthInsurance: totals.healthInsurance + month.healthInsurance,
        akupDeduction: totals.akupDeduction + month.akupForMonth,
        tax: totals.tax + month.taxForMonth,
        netIncome: totals.netIncome + month.netIncome,
      }),
      {
        totalGross: 0,
        totalZusContrib: 0,
        healthInsurance: 0,
        akupDeduction: 0,
        tax: 0,
        netIncome: 0,
      }
    );
  }, [calculations]);

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Calculator className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">
            Polish Tax Calculator 2025
          </h1>
        </div>
        <p className="text-gray-600">
          Calculate net income with AKUP (50% deduction on 80% of base salary),
          ZUS contributions, and progressive tax brackets.
        </p>
      </div>

      {/* Input Section */}
      <div className="mb-8 bg-gray-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          Monthly Compensation Input (PLN)
        </h2>

        {/* Quick base salary input */}
        <div className="mb-4 bg-white p-4 rounded-lg border-2 border-blue-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Set Base Salary for All Months
          </label>
          <input
            type="number"
            value={allMonthsBase}
            onChange={(e) => setAllBaseSalaries(e.target.value)}
            className="w-48 px-3 py-2 border rounded-md"
            placeholder="Enter amount to apply to all months"
          />
        </div>

        {/* Table input */}
        <div className="overflow-x-auto bg-white rounded-lg border">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left font-medium">Month</th>
                <th className="p-3 text-center font-medium">Base Salary</th>
                <th className="p-3 text-center font-medium">Cash LTI</th>
                <th className="p-3 text-center font-medium">On-call</th>
                <th className="p-3 text-center font-medium">Bonus</th>
                <th className="p-3 text-center font-medium">Total Gross</th>
              </tr>
            </thead>
            <tbody>
              {months.map((monthName, index) => {
                const monthTotal =
                  monthlyData[index].base +
                  monthlyData[index].cashLTI +
                  monthlyData[index].onCall +
                  monthlyData[index].bonus;
                return (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}
                  >
                    <td className="p-3 font-medium">{monthName}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={monthlyData[index].base || ""}
                        onChange={(e) =>
                          updateMonthData(index, "base", e.target.value)
                        }
                        className="w-full px-2 py-1 border rounded text-center text-sm"
                        placeholder="0"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={monthlyData[index].cashLTI || ""}
                        onChange={(e) =>
                          updateMonthData(index, "cashLTI", e.target.value)
                        }
                        className="w-full px-2 py-1 border rounded text-center text-sm"
                        placeholder="0"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={monthlyData[index].onCall || ""}
                        onChange={(e) =>
                          updateMonthData(index, "onCall", e.target.value)
                        }
                        className="w-full px-2 py-1 border rounded text-center text-sm"
                        placeholder="0"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={monthlyData[index].bonus || ""}
                        onChange={(e) =>
                          updateMonthData(index, "bonus", e.target.value)
                        }
                        className="w-full px-2 py-1 border rounded text-center text-sm"
                        placeholder="0"
                      />
                    </td>
                    <td className="p-3 text-center font-medium text-blue-700">
                      {monthTotal.toLocaleString("pl-PL")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Information */}
      <div className="mb-6 bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">
          2025 Tax Rules Applied:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-blue-700">
          <div>
            <strong>Tax Brackets:</strong>
            <br />
            12% up to 120,000 PLN
            <br />
            32% above 120,000 PLN
          </div>
          <div>
            <strong>ZUS Contributions:</strong>
            <br />
            Pension: 9.76%
            <br />
            Disability: 1.5%
            <br />
            Sickness: 2.45%
            <br />
            Annual limit: 260,190 PLN
          </div>
          <div>
            <strong>Health Insurance:</strong>
            <br />
            9% of all income
            <br />
            Min: 314.96 PLN/month
            <br />
            NOT deductible from taxable income
          </div>
          <div>
            <strong>AKUP:</strong>
            <br />
            50% deduction rate
            <br />
            On 80% of base salary after ZUS deductions
            <br />
            Annual limit: 120,000 PLN
          </div>
          <div>
            <strong>Coverage:</strong>
            <br />
            ZUS: Base + LTI + On-call + Bonus
            <br />
            AKUP: Base salary only (80%)
            <br />
            Tax: All income after deductions
          </div>
          <div>
            <strong>Misc:</strong>
            <br />
            Slight differences in final income might be caused by: vacation
            time-off (no AKUP), PPK, tax for benefits like: life insurance, sports
            card, wellness reimbursement etc.
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left font-semibold">Month</th>
              <th className="p-3 text-right font-semibold">Gross Total</th>
              <th className="p-3 text-right font-semibold">Pension</th>
              <th className="p-3 text-right font-semibold">Disability</th>
              <th className="p-3 text-right font-semibold">Sickness</th>
              <th className="p-3 text-right font-semibold">Health</th>
              <th className="p-3 text-right font-semibold">50% AKUP</th>
              <th className="p-3 text-right font-semibold">Tax</th>
              <th className="p-3 text-right font-semibold bg-green-100">
                Net Income
              </th>
              <th className="p-3 text-right font-semibold bg-gray-100">
                1st tax bracket limit remainnig
              </th>
              <th className="p-3 text-right font-semibold bg-gray-100">
                ZUS limit remainnig
              </th>
              <th className="p-3 text-right font-semibold bg-gray-100">
                AKUP limit remainnig
              </th>
            </tr>
          </thead>
          <tbody>
            {calculations.map((calc, index) => (
              <tr
                key={index}
                className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}
              >
                <td className="p-3 font-medium">{months[index]}</td>
                <td className="p-3 text-right">
                  {calc.totalGross.toLocaleString("pl-PL")}
                </td>
                <td className="p-3 text-right text-red-600">
                  -{calc.pensionContrib.toFixed(2).toLocaleString("pl-PL")}
                </td>
                <td className="p-3 text-right text-red-600">
                  -{calc.disabilityContrib.toFixed(2).toLocaleString("pl-PL")}
                </td>
                <td className="p-3 text-right text-red-600">
                  -{calc.sicknessContrib.toFixed(2).toLocaleString("pl-PL")}
                </td>
                <td className="p-3 text-right text-red-600">
                  -{calc.healthInsurance.toFixed(2).toLocaleString("pl-PL")}
                </td>
                <td className="p-3 text-right text-black-600">
                  {calc.akupForMonth.toFixed(2).toLocaleString("pl-PL")}
                </td>
                <td className="p-3 text-right text-red-600">
                  -{calc.taxForMonth.toFixed(2).toLocaleString("pl-PL")}
                </td>
                <td className="p-3 text-right font-semibold bg-green-50">
                  {calc.netIncome.toFixed(2).toLocaleString("pl-PL")}
                </td>
                <td className="p-3 text-right text-gray-600">
                  {calc.taxBracket1Remaining.toFixed(2).toLocaleString("pl-PL")}
                </td>
                <td className="p-3 text-right text-gray-600">
                  {calc.zusLimitRemaining.toFixed(2).toLocaleString("pl-PL")}
                </td>
                <td className="p-3 text-right text-gray-600">
                  {calc.akupLimitRemaining.toFixed(2).toLocaleString("pl-PL")}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-200 font-semibold">
            <tr>
              <td className="p-3">YEARLY TOTAL</td>
              <td className="p-3 text-right">
                {yearlyTotals.totalGross.toLocaleString("pl-PL")}
              </td>
              <td className="p-3 text-right text-red-600" colSpan="3">
                -{yearlyTotals.totalZusContrib.toFixed(2).toLocaleString("pl-PL")} (ZUS
                Total)
              </td>
              <td className="p-3 text-right text-red-600">
                -{yearlyTotals.healthInsurance.toFixed(2).toLocaleString("pl-PL")}
              </td>
              <td className="p-3 text-right text-green-600">
                {yearlyTotals.akupDeduction.toFixed(2).toLocaleString("pl-PL")}
              </td>
              <td className="p-3 text-right text-red-600">
                -{yearlyTotals.tax.toFixed(2).toLocaleString("pl-PL")}
              </td>
              <td className="p-3 text-right bg-green-100">
                {yearlyTotals.netIncome.toFixed(2).toLocaleString("pl-PL")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-100 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-800">
            {((yearlyTotals.netIncome / yearlyTotals.totalGross) * 100).toFixed(
              2
            )}
            %
          </div>
          <div className="text-blue-600">Effective Net Rate</div>
        </div>
      </div>
    </div>
  );
};

export default PolishTaxCalculator;
