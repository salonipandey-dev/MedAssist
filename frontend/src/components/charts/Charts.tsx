import { useId } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, Panel } from '../ui';
const COLORS = ['#0D9488', '#6366F1', '#5BA5B7', '#9AAEC7'];
const tooltip = {
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 11,
  boxShadow: 'var(--shadow)',
};
export function DistributionChart({
  title,
  data,
  description,
}: {
  title: string;
  data: { name: string; value: number }[];
  description?: string;
}) {
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <Panel title={title} description={description} action={<Badge>Sample Data</Badge>}>
      <div className="distribution-chart">
        <div
          className="donut-wrap"
          role="img"
          aria-label={`${title}: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}. Total ${total}.`}
        >
          <ResponsiveContainer width="100%" height={200} minWidth={0}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={61}
                outerRadius={80}
                paddingAngle={total ? 3 : 0}
                dataKey="value"
                stroke="none"
                isAnimationActive={false}
              >
                {data.map((d, i) => (
                  <Cell key={d.name} fill={COLORS[i % 4]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <strong>{total}</strong>
            <span>sample records</span>
          </div>
        </div>
        <ul className="chart-legend">
          {data.map((d, i) => (
            <li key={d.name}>
              <span style={{ background: COLORS[i % 4] }} />
              <span>{d.name}</span>
              <strong>{d.value}</strong>
            </li>
          ))}
        </ul>
      </div>
      <details className="chart-data">
        <summary>View accessible data summary</summary>
        <table>
          <caption className="sr-only">{title} sample dataset</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Count</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.name}>
                <th scope="row">{d.name}</th>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Panel>
  );
}
export function TrendChart({
  title,
  data,
  kind = 'area',
  series = [
    { key: 'cases', label: 'Cases', color: '#0D9488' },
    { key: 'appointments', label: 'Appointments', color: '#6366F1' },
  ],
  description,
}: {
  title: string;
  data: { name: string; [key: string]: string | number }[];
  kind?: 'area' | 'bar';
  series?: { key: string; label: string; color: string }[];
  description?: string;
}) {
  const id = useId().replace(/:/g, '');
  const axes = (
    <>
      <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 4" />
      <XAxis
        dataKey="name"
        tick={{ fill: 'var(--muted)', fontSize: 10 }}
        axisLine={false}
        tickLine={false}
        dy={8}
      />
      <YAxis
        allowDecimals={false}
        tick={{ fill: 'var(--muted)', fontSize: 10 }}
        axisLine={false}
        tickLine={false}
        width={27}
      />
      <Tooltip contentStyle={tooltip} cursor={{ stroke: 'var(--border)' }} />
      <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 10, paddingTop: 20 }} />
    </>
  );
  return (
    <Panel title={title} description={description} action={<Badge>Sample Data</Badge>}>
      <div
        className="trend-chart"
        role="img"
        aria-label={`${title}. ${data.map((d) => `${d.name}: ${series.map((s) => `${s.label} ${d[s.key]}`).join(', ')}`).join('; ')}.`}
      >
        <ResponsiveContainer width="100%" height={245} minWidth={0}>
          {kind === 'area' ? (
            <AreaChart data={data} margin={{ left: 0, right: 16, top: 14, bottom: 2 }}>
              {axes}
              <defs>
                {series.map((s) => (
                  <linearGradient id={`${id}-${s.key}`} key={s.key} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              {series.map((s) => (
                <Area
                  key={s.key}
                  name={s.label}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  fill={`url(#${id}-${s.key})`}
                  strokeWidth={2.3}
                  dot={{ r: 3, strokeWidth: 2, fill: 'var(--surface)' }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ left: 0, right: 16, top: 14, bottom: 2 }}>
              {axes}
              {series.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <details className="chart-data">
        <summary>View accessible data summary</summary>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">{title} sample dataset</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                {series.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.name}>
                  <th scope="row">{d.name}</th>
                  {series.map((s) => (
                    <td key={s.key}>{d[s.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Panel>
  );
}
