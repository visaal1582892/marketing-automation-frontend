import Icon from '../../../components/Icon'

export default function SlaCycleTimeReport({ data, loading }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Icon name="loader" className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm text-slate-500">Loading SLA & Cycle Time...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="bg-indigo-50 p-4 rounded-full mb-6">
        <Icon name="clock" className="h-10 w-10 text-indigo-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">SLA & Cycle Time Pipeline</h2>
      <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
        The data infrastructure for detailed time-tracking and service-level agreements is currently being integrated. 
        <br /><br />
        Check back soon to see bottlenecks, approval cycle durations, and time efficiency metrics for your department!
      </p>
    </div>
  );
}
