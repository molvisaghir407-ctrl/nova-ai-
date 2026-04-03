/**
 * Nova AI Assistant - Tool Definitions
 * Defines all available tools/commands that Nova can execute
 */

export interface ToolDefinition {
  name: string;
  description: string;
  category: 'pc_control' | 'web' | 'media' | 'system' | 'productivity' | 'info';
  parameters: Record<string, {
    type: string;
    description: string;
    required: boolean;
    enum?: string[];
  }>;
  safetyLevel: 'safe' | 'standard' | 'sensitive' | 'dangerous';
  requiresConfirmation: boolean;
}

export const TOOLS: ToolDefinition[] = [
  // PC Control - Applications
  {
    name: 'launch_app',
    description: 'Launch an application by name or path',
    category: 'pc_control',
    parameters: {
      app_name: { type: 'string', description: 'Name or path of the application to launch', required: true },
      args: { type: 'array', description: 'Command line arguments', required: false },
    },
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },
  {
    name: 'close_app',
    description: 'Close an application by name or window title',
    category: 'pc_control',
    parameters: {
      app_name: { type: 'string', description: 'Name or window title of the application', required: true },
      force: { type: 'boolean', description: 'Force close if application is not responding', required: false },
    },
    safetyLevel: 'standard',
    requiresConfirmation: false,
  },
  {
    name: 'list_windows',
    description: 'List all open windows and applications',
    category: 'pc_control',
    parameters: {},
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },
  {
    name: 'focus_window',
    description: 'Bring a window to focus by title pattern',
    category: 'pc_control',
    parameters: {
      title_pattern: { type: 'string', description: 'Regex pattern to match window title', required: true },
    },
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },

  // PC Control - System
  {
    name: 'adjust_volume',
    description: 'Set system volume level or mute/unmute',
    category: 'pc_control',
    parameters: {
      level: { type: 'number', description: 'Volume level 0-100, or "mute"/"unmute"', required: true },
    },
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },
  {
    name: 'set_brightness',
    description: 'Set screen brightness level',
    category: 'pc_control',
    parameters: {
      level: { type: 'number', description: 'Brightness level 0-100', required: true },
    },
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },
  {
    name: 'system_power',
    description: 'Control system power state',
    category: 'pc_control',
    parameters: {
      action: { 
        type: 'string', 
        description: 'Power action to perform', 
        required: true,
        enum: ['shutdown', 'restart', 'sleep', 'lock', 'logout'],
      },
    },
    safetyLevel: 'dangerous',
    requiresConfirmation: true,
  },
  {
    name: 'get_system_info',
    description: 'Get current system information (CPU, memory, disk, network)',
    category: 'system',
    parameters: {},
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },

  // PC Control - Input
  {
    name: 'type_text',
    description: 'Type text into the active window',
    category: 'pc_control',
    parameters: {
      text: { type: 'string', description: 'Text to type', required: true },
      interval: { type: 'number', description: 'Interval between keystrokes in seconds', required: false },
    },
    safetyLevel: 'sensitive',
    requiresConfirmation: false,
  },
  {
    name: 'press_keys',
    description: 'Press keyboard shortcut or combination',
    category: 'pc_control',
    parameters: {
      keys: { type: 'array', description: 'List of keys to press (e.g., ["ctrl", "c"])', required: true },
    },
    safetyLevel: 'sensitive',
    requiresConfirmation: false,
  },
  {
    name: 'take_screenshot',
    description: 'Capture a screenshot of the screen or a region',
    category: 'pc_control',
    parameters: {
      region: { type: 'object', description: 'Region to capture {x, y, width, height}', required: false },
    },
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },

  // PC Control - Files
  {
    name: 'search_files',
    description: 'Search for files by name or content',
    category: 'pc_control',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true },
      directory: { type: 'string', description: 'Directory to search in', required: false },
    },
    safetyLevel: 'standard',
    requiresConfirmation: false,
  },
  {
    name: 'open_file',
    description: 'Open a file with the default or specified application',
    category: 'pc_control',
    parameters: {
      path: { type: 'string', description: 'Path to the file', required: true },
      app: { type: 'string', description: 'Application to open with', required: false },
    },
    safetyLevel: 'standard',
    requiresConfirmation: false,
  },
  {
    name: 'delete_file',
    description: 'Delete a file or move to recycle bin',
    category: 'pc_control',
    parameters: {
      path: { type: 'string', description: 'Path to the file', required: true },
      permanent: { type: 'boolean', description: 'Permanently delete (bypass recycle bin)', required: false },
    },
    safetyLevel: 'dangerous',
    requiresConfirmation: true,
  },

  // Web & Research
  {
    name: 'web_search',
    description: 'Search the web for information',
    category: 'web',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true },
      num_results: { type: 'number', description: 'Number of results to return', required: false },
    },
    safetyLevel: 'standard',
    requiresConfirmation: false,
  },
  {
    name: 'read_webpage',
    description: 'Extract content from a webpage',
    category: 'web',
    parameters: {
      url: { type: 'string', description: 'URL to read', required: true },
    },
    safetyLevel: 'standard',
    requiresConfirmation: false,
  },

  // Media Control
  {
    name: 'play_media',
    description: 'Play media (music, video) from local files or online',
    category: 'media',
    parameters: {
      query: { type: 'string', description: 'What to play (song name, video, etc.)', required: true },
      source: { 
        type: 'string', 
        description: 'Media source', 
        required: false,
        enum: ['youtube', 'spotify', 'local', 'auto'],
      },
    },
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },
  {
    name: 'media_control',
    description: 'Control media playback',
    category: 'media',
    parameters: {
      action: { 
        type: 'string', 
        description: 'Playback action', 
        required: true,
        enum: ['play', 'pause', 'next', 'previous', 'stop'],
      },
    },
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },

  // Productivity
  {
    name: 'create_task',
    description: 'Create a new task or reminder',
    category: 'productivity',
    parameters: {
      title: { type: 'string', description: 'Task title', required: true },
      description: { type: 'string', description: 'Task description', required: false },
      due_date: { type: 'string', description: 'Due date (ISO format or natural language)', required: false },
      priority: { type: 'number', description: 'Priority 1-10', required: false },
    },
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },
  {
    name: 'list_tasks',
    description: 'List all tasks or filter by status',
    category: 'productivity',
    parameters: {
      status: { 
        type: 'string', 
        description: 'Filter by status', 
        required: false,
        enum: ['pending', 'in_progress', 'completed', 'all'],
      },
    },
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },
  {
    name: 'create_reminder',
    description: 'Create a timed reminder',
    category: 'productivity',
    parameters: {
      message: { type: 'string', description: 'Reminder message', required: true },
      time: { type: 'string', description: 'When to remind (ISO format or natural language)', required: true },
    },
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },

  // Memory & Information
  {
    name: 'remember',
    description: 'Store a fact or preference in memory',
    category: 'info',
    parameters: {
      category: { type: 'string', description: 'Category (fact, preference, note)', required: true },
      content: { type: 'string', description: 'Content to remember', required: true },
      importance: { type: 'number', description: 'Importance 0.0-1.0', required: false },
    },
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },
  {
    name: 'recall',
    description: 'Recall information from memory',
    category: 'info',
    parameters: {
      query: { type: 'string', description: 'What to recall', required: true },
      limit: { type: 'number', description: 'Number of results', required: false },
    },
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },

  // Clipboard
  {
    name: 'clipboard_set',
    description: 'Set clipboard content',
    category: 'pc_control',
    parameters: {
      text: { type: 'string', description: 'Text to copy', required: true },
    },
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },
  {
    name: 'clipboard_get',
    description: 'Get clipboard content',
    category: 'pc_control',
    parameters: {},
    safetyLevel: 'sensitive',
    requiresConfirmation: false,
  },

  // Notifications
  {
    name: 'send_notification',
    description: 'Send a desktop notification',
    category: 'system',
    parameters: {
      title: { type: 'string', description: 'Notification title', required: true },
      message: { type: 'string', description: 'Notification message', required: true },
    },
    safetyLevel: 'safe',
    requiresConfirmation: false,
  },
];

export function getToolsByCategory(): Record<string, ToolDefinition[]> {
  return TOOLS.reduce((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, ToolDefinition[]>);
}

export function getToolByName(name: string): ToolDefinition | undefined {
  return TOOLS.find(t => t.name === name);
}

export function getToolSchemaForLLM(): object[] {
  return TOOLS.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters,
        required: Object.entries(tool.parameters)
          .filter(([_, p]) => p.required)
          .map(([name, _]) => name),
      },
    },
  }));
}
