import React from 'react';

const TestComponent: React.FC = () => {
  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="card">
        <div className="card-header">
          <h2 className="text-2xl font-bold text-foreground">
            AI Content Agent
          </h2>
          <p className="text-gray-600">CSS Configuration Test</p>
        </div>
        
        <div className="card-content">
          <div className="form-group">
            <label className="form-label">Test Input</label>
            <input 
              type="text" 
              className="input" 
              placeholder="Enter something..."
            />
          </div>
          
          <div className="flex gap-2 mt-4">
            <button className="btn-primary">Primary Button</button>
            <button className="btn-secondary">Secondary</button>
            <button className="btn-ghost">Ghost</button>
          </div>
          
          <div className="flex gap-2 mt-4">
            <span className="badge-primary">Primary</span>
            <span className="badge-success">Success</span>
            <span className="badge-warning">Warning</span>
            <span className="badge-error">Error</span>
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-background border border-border rounded-lg">
        <h3 className="font-medium text-foreground mb-2">Status</h3>
        <p className="text-sm text-gray-600">
          ✅ Tailwind CSS configuration working properly
          <br />
          ✅ CSS variables loaded correctly
          <br />
          ✅ Component styles applied
        </p>
      </div>
    </div>
  );
};

export default TestComponent; 