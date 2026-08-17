import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3001,
  jiraBaseUrl: process.env.JIRA_BASE_URL || 'https://task.ascvn.com.vn',
};
