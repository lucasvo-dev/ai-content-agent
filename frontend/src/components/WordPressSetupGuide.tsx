import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface WordPressSetupGuideProps {
  onClose?: () => void;
}

export const WordPressSetupGuide: React.FC<WordPressSetupGuideProps> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);

  const steps = [
    {
      title: "Kiểm tra WordPress Version",
      content: (
        <div className="space-y-3">
          <p>WordPress Application Passwords cần <strong>WordPress 5.6+</strong></p>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Đăng nhập WordPress Admin</li>
            <li>Vào <strong>Dashboard → Updates</strong></li>
            <li>Kiểm tra version ≥ 5.6</li>
          </ol>
        </div>
      )
    },
    {
      title: "Tạo Application Password",
      content: (
        <div className="space-y-3">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Đăng nhập <strong>WordPress Admin</strong></li>
            <li>Vào <strong>Users → Your Profile</strong></li>
            <li>Scroll xuống phần <strong>"Application Passwords"</strong></li>
            <li>Nhập tên: <code className="bg-gray-100 px-1 rounded">AI Content Agent</code></li>
            <li>Click <strong>"Add New Application Password"</strong></li>
            <li><strong>Copy password</strong> được tạo (dạng: xxxx xxxx xxxx xxxx)</li>
          </ol>
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
            <p className="text-sm text-yellow-800">
              <strong>Lưu ý:</strong> Application Password khác với WordPress login password. 
              Đây là password riêng biệt cho API access.
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Cấu hình trong AI Content Agent",
      content: (
        <div className="space-y-3">
          <div className="space-y-2">
            <div>
              <strong>Site URL:</strong> 
              <code className="bg-gray-100 px-1 rounded ml-2">https://your-site.com</code>
              <span className="text-sm text-gray-600 ml-2">(không có trailing slash)</span>
            </div>
            <div>
              <strong>Username:</strong> 
              <code className="bg-gray-100 px-1 rounded ml-2">admin</code>
              <span className="text-sm text-gray-600 ml-2">(WordPress username)</span>
            </div>
            <div>
              <strong>Application Password:</strong> 
              <code className="bg-gray-100 px-1 rounded ml-2">xxxx xxxx xxxx xxxx</code>
              <span className="text-sm text-gray-600 ml-2">(giữ nguyên spaces)</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">WordPress Setup Guide</h2>
          {onClose && (
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          )}
        </div>

        {/* Progress indicator */}
        <div className="flex items-center mb-6">
          {steps.map((_, index) => (
            <React.Fragment key={index}>
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index + 1 <= currentStep 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div 
                  className={`flex-1 h-1 mx-2 ${
                    index + 1 < currentStep ? 'bg-blue-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Current step content */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">
            Bước {currentStep}: {steps[currentStep - 1].title}
          </h3>
          {steps[currentStep - 1].content}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <Button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="px-4 py-2 text-sm"
          >
            ← Quay lại
          </Button>
          
          {currentStep < steps.length ? (
            <Button
              onClick={nextStep}
              className="px-4 py-2 text-sm bg-blue-500 text-white hover:bg-blue-600"
            >
              Tiếp theo →
            </Button>
          ) : (
            <Button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-green-500 text-white hover:bg-green-600"
            >
              Hoàn thành ✓
            </Button>
          )}
        </div>

        {/* Troubleshooting section */}
        {currentStep === steps.length && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-medium mb-3">Troubleshooting</h4>
            <div className="space-y-2 text-sm">
              <div>
                <strong>Lỗi "Authentication failed":</strong> Kiểm tra lại Application Password
              </div>
              <div>
                <strong>Lỗi "REST API not found":</strong> Kiểm tra plugin security hoặc hosting settings
              </div>
              <div>
                <strong>Lỗi "Access forbidden":</strong> Đảm bảo user có role Administrator/Editor
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default WordPressSetupGuide; 