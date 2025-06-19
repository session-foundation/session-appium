import path from 'path';

export const allureResultsDir = path.join('allure', 'allure-results');
export const allureCurrentReportDir = path.join('allure', 'allure-report');
export const allureReportsDir = path.join('allure', 'reports');
export const resultsHistoryDir = path.join(allureResultsDir, 'history');
export const reportHistoryDir = path.join(allureCurrentReportDir, 'history');
