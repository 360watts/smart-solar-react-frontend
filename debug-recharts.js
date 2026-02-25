const React = require('react');
const Recharts = require('recharts');

console.log('Recharts exports keys:', Object.keys(Recharts).sort());

const components = [
  'AreaChart', 'Area', 'Line', 'ReferenceArea',
  'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'ResponsiveContainer', 'Legend', 'Brush', 'ReferenceLine'
];

components.forEach(comp => {
  if (!Recharts[comp]) {
    console.error(`ERROR: ${comp} is undefined in Recharts exports!`);
  } else {
    console.log(`OK: ${comp} is defined`);
  }
});
