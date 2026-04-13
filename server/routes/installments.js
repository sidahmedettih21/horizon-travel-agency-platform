const express = require('express');
const router = express.Router();

// Helper: Calculate max affordable package based on contributor salary
function calculateMaxAffordable(salary, months = 10) {
  const maxMonthlyPayment = salary * 0.3;
  return maxMonthlyPayment * months;
}

// Helper: Distribute required monthly payment among contributors
function distributePayment(requiredMonthly, contributors, method = 'proportional') {
  const totalSalary = contributors.reduce((sum, c) => sum + c.salary, 0);
  const distributions = [];
  let remaining = requiredMonthly;

  if (method === 'proportional') {
    contributors.forEach(c => {
      const share = (c.salary / totalSalary) * requiredMonthly;
      const cappedShare = Math.min(share, c.salary * 0.3);
      distributions.push({ name: c.name, amount: cappedShare });
      remaining -= cappedShare;
    });
  } else if (method === 'equal') {
    const equalShare = requiredMonthly / contributors.length;
    contributors.forEach(c => {
      const capped = Math.min(equalShare, c.salary * 0.3);
      distributions.push({ name: c.name, amount: capped });
      remaining -= capped;
    });
  }

  // Redistribute remaining if possible
  if (remaining > 0.01) {
    distributions.sort((a, b) => {
      const capA = contributors.find(c => c.name === a.name).salary * 0.3;
      const capB = contributors.find(c => c.name === b.name).salary * 0.3;
      return (capA - a.amount) - (capB - b.amount);
    });
    for (let d of distributions) {
      const contributor = contributors.find(c => c.name === d.name);
      const maxExtra = contributor.salary * 0.3 - d.amount;
      const add = Math.min(remaining, maxExtra);
      d.amount += add;
      remaining -= add;
      if (remaining <= 0.01) break;
    }
  }

  return { distributions, remaining };
}

// System 1: Check eligibility for a given package price
router.post('/check-eligibility', (req, res) => {
  const { packagePrice, downPayment, months = 10, contributors } = req.body;
  const requiredMonthly = (packagePrice - downPayment) / months;
  const { distributions, remaining } = distributePayment(requiredMonthly, contributors, 'proportional');

  const approved = remaining < 0.01;
  let minDownPayment = 0;
  if (!approved) {
    // Calculate minimum down payment to make it work
    const maxAffordableMonthly = contributors.reduce((sum, c) => sum + c.salary * 0.3, 0);
    const maxTotalAffordable = maxAffordableMonthly * months;
    minDownPayment = Math.max(0, packagePrice - maxTotalAffordable);
  }

  res.json({
    approved,
    requiredMonthly,
    distributions,
    minDownPayment: Math.ceil(minDownPayment),
    maxMonthlyPerContributor: contributors.map(c => ({ name: c.name, max: c.salary * 0.3 }))
  });
});

// System 2: Calculate maximum affordable package
router.post('/max-affordable', (req, res) => {
  const { downPayment, months = 10, contributors } = req.body;
  const totalMaxMonthly = contributors.reduce((sum, c) => sum + c.salary * 0.3, 0);
  const maxTotalFromInstallments = totalMaxMonthly * months;
  const maxPackage = downPayment + maxTotalFromInstallments;

  res.json({
    maxPackage: Math.floor(maxPackage),
    maxMonthlyTotal: totalMaxMonthly,
    monthlyPerContributor: contributors.map(c => ({ name: c.name, max: c.salary * 0.3 }))
  });
});module.exports = router;
