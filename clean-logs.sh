#!/bin/bash

echo "🧹 Cleaning log files..."

# Clean root logs
echo "" > logs/backend.log
echo "" > logs/frontend.log
echo "" > logs/combined.log
echo "" > logs/exceptions.log
echo "" > logs/rejections.log
echo "" > logs/error.log

# Clean backend logs
echo "" > backend/logs/combined.log
echo "" > backend/logs/exceptions.log
echo "" > backend/logs/error.log
echo "" > backend/logs/rejections.log

echo "✅ All log files cleaned!" 