import { Task } from '../entities/Task';

/**
 * Analyzes a task name to determine if it's vague or needs improvement
 * Returns an object with analysis results and suggestions
 */
export interface TaskAnalysis {
  isVague: boolean;
  reason: 'short' | 'no_verb' | 'vague_pattern' | 'good';
  suggestion?: string;
  severity: 'low' | 'medium' | 'high';
}

export const analyzeTaskName = (taskName: string): TaskAnalysis => {
  const trimmedName = taskName.toLowerCase().trim();
  
  // Very short tasks (less than 10 chars) - original logic
  if (trimmedName.length > 0 && trimmedName.length < 10) {
    return {
      isVague: true,
      reason: 'short',
      suggestion: 'task.suggestions.short',
      severity: 'medium'
    };
  }
  
  // Skip if it's already a next action (contains →)
  if (trimmedName.includes('→')) {
    return {
      isVague: false,
      reason: 'good',
      severity: 'low'
    };
  }
  
  // More comprehensive action verb patterns
  const actionVerbPatterns = [
    // Direct action verbs at start
    /^(call|email|text|message|phone|contact)/,
    /^(write|draft|compose|type|create|make)/,
    /^(read|review|check|examine|study|analyze)/,
    /^(buy|purchase|order|get|obtain|acquire)/,
    /^(schedule|book|arrange|plan|set up|setup)/,
    /^(meet|discuss|talk|speak|chat)/,
    /^(send|deliver|ship|mail|forward)/,
    /^(update|edit|modify|change|fix|correct)/,
    /^(finish|complete|finalize|wrap up)/,
    /^(submit|file|upload|post|publish)/,
    /^(organize|sort|clean|tidy|arrange)/,
    /^(research|find|search|look up|investigate)/,
    /^(prepare|gather|collect|assemble)/,
    /^(install|download|set up|configure)/,
    /^(test|try|experiment|validate)/,
    /^(backup|save|export|archive)/,
    /^(delete|remove|uninstall|cancel)/,
    
    // Gerund forms (-ing verbs) which are often good actions
    /^(calling|emailing|writing|reading|buying|scheduling|meeting|sending|updating|finishing|submitting|organizing|researching|preparing|installing|testing|backing)/,
    
    // Question patterns (usually clear next actions)
    /^(what|how|when|where|why|which)/,
    /\?$/,
    
    // Imperative patterns with objects
    /^(add|remove|insert|attach|include|exclude)/,
    /^(start|begin|initiate|launch|kick off)/,
    /^(stop|end|terminate|close|shut)/,
    
    // Common task patterns
    /^(follow up|followup)/,
    /^(sign up|signup)/,
    /^(log in|login)/,
    /^(pick up|pickup)/,
    /^(drop off|dropoff)/,
    /^(set up|setup)/,
    /^(clean up|cleanup)/,
    /^(wrap up|wrapup)/
  ];
  
  // Check if task starts with any action verb pattern
  const hasActionVerb = actionVerbPatterns.some(pattern => pattern.test(trimmedName));
  if (hasActionVerb) {
    return {
      isVague: false,
      reason: 'good',
      severity: 'low'
    };
  }
  
  // Check for common non-actionable patterns (these are vague)
  const vaguePatterns = [
    // Single words without context
    /^[a-zA-Z]+$/,
    // Just names without action
    /^[A-Z][a-z]+ [A-Z][a-z]+$/,
    // Just project/area names
    /^(project|website|app|system|process|issue|problem|bug|feature)$/i,
    // Very short tasks without clear action (less than 3 words)
    /^(\w+\s+\w+|^\w+)$/
  ];
  
  // Only flag as vague if it matches vague patterns AND is not clearly actionable
  const matchesVaguePattern = vaguePatterns.some(pattern => pattern.test(trimmedName));
  
  // Additional checks for good tasks that shouldn't be flagged
  const hasGoodStructure = (
    trimmedName.length > 15 || // Longer tasks are usually more specific
    trimmedName.split(' ').length > 3 || // More than 3 words usually means more specific
    /\b(for|with|to|from|about|regarding|re:|fwd:)\b/.test(trimmedName) || // Prepositions indicate context
    /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week)\b/.test(trimmedName) || // Time references
    /\b(project|meeting|appointment|deadline|due|urgent|important)\b/.test(trimmedName) // Context indicators
  );
  
  if (matchesVaguePattern && !hasGoodStructure) {
    return {
      isVague: true,
      reason: 'vague_pattern',
      suggestion: 'task.suggestions.vague',
      severity: 'high'
    };
  }
  
  // Check for missing action verbs (less strict)
  if (!hasActionVerb && trimmedName.split(' ').length <= 2) {
    return {
      isVague: true,
      reason: 'no_verb',
      suggestion: 'task.suggestions.noVerb',
      severity: 'medium'
    };
  }
  
  return {
    isVague: false,
    reason: 'good',
    severity: 'low'
  };
};

/**
 * Filters tasks to find vague ones using the enhanced logic
 */
export const getVagueTasks = (tasks: Task[]): Task[] => {
  return tasks.filter(task => {
    if (task.status === 'done' || task.status === 'archived') return false;
    
    const analysis = analyzeTaskName(task.name);
    return analysis.isVague;
  });
};

/**
 * Gets a user-friendly suggestion for improving a task name
 */
export const getTaskNameSuggestion = (taskName: string): string | null => {
  const analysis = analyzeTaskName(taskName);
  return analysis.isVague ? (analysis.suggestion || null) : null;
};