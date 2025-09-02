# Sigma Dropdown Auto-Selector Plugin

A custom Sigma Computing plugin that automatically selects the first available option in dropdown controls.

## 🚀 Live Demo
[https://twells89.github.io/sigma-dropdown-auto-selector/](https://twells89.github.io/sigma-dropdown-auto-selector/)

## Features
- 🔄 Automatic first option selection
- 🎯 Configurable target controls  
- 🔁 Retry logic for reliability
- 📋 Script generation for standalone use
- 🎨 User-friendly interface

## Quick Start
1. Add this plugin to your Sigma workbook
2. Configure the target dropdown control ID
3. Enable auto-trigger or manually execute selection

```bash

npm install
cd sigma-dropdown-auto-selector

cd sigma-dropdown-auto-selector

cat > src/App.tsx << 'EOF'
// App.tsx - Main plugin component
import React, { useEffect, useState } from 'react';
import { initialize, PluginInstance } from '@sigmacomputing/plugin';

interface PluginConfig {
  targetControl: string;
  autoTrigger: boolean;
  instructions: string;
  triggerOnLoad: boolean;
  retryAttempts: string;
}

// Initialize the Sigma plugin client
const client: PluginInstance<PluginConfig> = initialize();

// Configure the plugin's editor panel
client.config.configureEditorPanel([
  {
    name: 'targetControl',
    type: 'text',
    placeholder: 'Enter control ID (e.g., "dropdown-1")',
    defaultValue: ''
  },
  {
    name: 'triggerOnLoad',
    type: 'toggle',
    defaultValue: true
  },
  {
    name: 'retryAttempts',
    type: 'text',
    placeholder: 'Number of retry attempts (default: 3)',
    defaultValue: '3'
  },
  {
    name: 'autoTrigger',
    type: 'toggle', 
    defaultValue: true
  },
  {
    name: 'instructions',
    type: 'text',
    multiline: true,
    defaultValue: 'This plugin monitors a dropdown control and automatically selects the first available option when the workbook loads or when triggered.',
    placeholder: 'Instructions for users'
  }
]);

const App: React.FC = () => {
  const [config, setConfig] = useState<Partial<PluginConfig>>(client.config.get() || {});
  const [status, setStatus] = useState<string>('Initializing...');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastAttempt, setLastAttempt] = useState<string>('');

  useEffect(() => {
    // Subscribe to configuration changes
    const unsubscribe = client.config.subscribe((newConfig: Partial<PluginConfig>) => {
      setConfig(newConfig);
      if (newConfig.targetControl) {
        setStatus(`Configured to monitor: ${newConfig.targetControl}`);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Auto-trigger on load if enabled
    if (config?.triggerOnLoad && config?.targetControl) {
      setTimeout(() => {
        triggerAutoSelection();
      }, 2000); // Wait 2 seconds for page to fully load
    }
  }, [config?.triggerOnLoad, config?.targetControl]);

  // Generate the control selection script
  const generateControlScript = (): string => {
    if (!config?.targetControl) return '';
    
    const retryAttempts = parseInt(config.retryAttempts || '3', 10);
    
    return `
// Sigma Dropdown Auto-Selector Script
// Target Control: ${config.targetControl}
// Generated: ${new Date().toISOString()}

(function() {
  const CONFIG = {
    targetControlId: '${config.targetControl}',
    maxRetries: ${retryAttempts},
    retryDelay: 500,
    observerTimeout: 30000
  };

  let attempts = 0;
  
  function log(message) {
    console.log('[Sigma Auto-Selector]', message);
  }
  
  function selectFirstOption() {
    attempts++;
    log(\`Attempt \${attempts} to find and select dropdown option\`);
    
    // Strategy 1: Look for control by data attribute
    let dropdown = document.querySelector(\`[data-control-id="\${CONFIG.targetControlId}"]\`);
    
    if (!dropdown) {
      // Strategy 2: Look for control by aria-label or title
      dropdown = document.querySelector(\`[aria-label*="\${CONFIG.targetControlId}"], [title*="\${CONFIG.targetControlId}"]\`);
    }
    
    if (!dropdown) {
      // Strategy 3: Look for any dropdown in proximity
      const allDropdowns = Array.from(document.querySelectorAll('select, [role="combobox"], [role="listbox"], [class*="dropdown"], [class*="select"]'));
      
      // Find dropdown that might be our target
      dropdown = allDropdowns.find(el => {
        const parent = el.closest('[data-testid], [class*="control"], [class*="filter"]');
        return parent && (parent.textContent || '').includes(CONFIG.targetControlId);
      });
    }
    
    if (dropdown) {
      log('Found dropdown element:', dropdown);
      
      // Handle different dropdown types
      if (dropdown.tagName === 'SELECT') {
        return handleSelectDropdown(dropdown);
      } else {
        return handleCustomDropdown(dropdown);
      }
    } else {
      log('Dropdown not found');
      return false;
    }
  }
  
  function handleSelectDropdown(select) {
    if (select.options && select.options.length > 0) {
      // Skip first option if it's empty/placeholder
      const startIndex = (select.options[0].value === '' || select.options[0].textContent.trim() === '') ? 1 : 0;
      
      if (select.options.length > startIndex) {
        select.selectedIndex = startIndex;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select.dispatchEvent(new Event('input', { bubbles: true }));
        log(\`Selected option: "\${select.options[startIndex].textContent}"\`);
        return true;
      }
    }
    return false;
  }
  
  function handleCustomDropdown(dropdown) {
    // Try to open the dropdown first
    dropdown.click();
    
    setTimeout(() => {
      // Look for options that appeared
      const options = document.querySelectorAll(
        '[role="option"], [data-value], .dropdown-item, .select-option, [class*="option"]'
      );
      
      if (options.length > 0) {
        // Filter for visible options
        const visibleOptions = Array.from(options).filter(option => {
          const rect = option.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        
        if (visibleOptions.length > 0) {
          const firstOption = visibleOptions[0];
          firstOption.click();
          log(\`Selected option: "\${firstOption.textContent?.trim()}"\`);
          return true;
        }
      }
      
      log('No visible options found after opening dropdown');
      return false;
    }, 200);
    
    return true; // Assume success for async operation
  }
  
  function trySelectWithRetry() {
    if (selectFirstOption()) {
      log('Selection completed successfully');
      return;
    }
    
    if (attempts < CONFIG.maxRetries) {
      log(\`Retrying in \${CONFIG.retryDelay}ms... (attempt \${attempts + 1}/\${CONFIG.maxRetries})\`);
      setTimeout(trySelectWithRetry, CONFIG.retryDelay);
    } else {
      log('Max retry attempts reached. Setting up DOM observer...');
      setupDOMObserver();
    }
  }
  
  function setupDOMObserver() {
    const observer = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          if (selectFirstOption()) {
            observer.disconnect();
            log('Selection completed via DOM observer');
            return;
          }
        }
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Clean up observer after timeout
    setTimeout(() => {
      observer.disconnect();
      log('DOM observer timeout reached');
    }, CONFIG.observerTimeout);
  }
  
  // Start the process
  log('Starting auto-selection process...');
  trySelectWithRetry();
  
})();`;
  };

  const copyScript = (): void => {
    const script = generateControlScript();
    navigator.clipboard.writeText(script).then(() => {
      setStatus('Script copied to clipboard!');
      setTimeout(() => {
        setStatus(`Ready - monitoring: ${config?.targetControl}`);
      }, 2000);
    });
  };

  const triggerAutoSelection = (): void => {
    if (!config?.targetControl) {
      setStatus('Please configure target control first');
      return;
    }

    setIsLoading(true);
    setStatus('Executing auto-selection...');
    setLastAttempt(new Date().toLocaleTimeString());
    
    // Execute the script
    try {
      const script = generateControlScript();
      const scriptElement = document.createElement('script');
      scriptElement.textContent = script;
      document.head.appendChild(scriptElement);
      document.head.removeChild(scriptElement);
      
      setTimeout(() => {
        setStatus('Auto-selection script executed');
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      setStatus('Error executing script: ' + (error as Error).message);
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
      maxWidth: '450px',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      border: '1px solid #e1e5e9'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: config?.targetControl ? '#28a745' : '#ffc107',
          marginRight: '12px'
        }} />
        <h3 style={{ margin: 0, color: '#343a40', fontSize: '18px' }}>
          Dropdown Auto-Selector
        </h3>
      </div>
      
      {config?.instructions && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f8f9fa',
          borderLeft: '3px solid #007bff',
          marginBottom: '16px',
          fontSize: '14px',
          lineHeight: '1.4',
          color: '#6c757d'
        }}>
          {config.instructions}
        </div>
      )}
      
      <div style={{ marginBottom: '12px' }}>
        <strong style={{ color: '#495057' }}>Target Control:</strong>
        <div style={{ 
          marginTop: '4px',
          padding: '8px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '13px',
          color: config?.targetControl ? '#28a745' : '#6c757d'
        }}>
          {config?.targetControl || 'Not configured'}
        </div>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <strong style={{ color: '#495057' }}>Status:</strong>
        <div style={{
          marginTop: '4px',
          padding: '8px',
          backgroundColor: isLoading ? '#fff3cd' : '#d4edda',
          border: `1px solid ${isLoading ? '#ffeaa7' : '#c3e6cb'}`,
          borderRadius: '4px',
          color: isLoading ? '#856404' : '#155724',
          fontSize: '14px'
        }}>
          {status}
        </div>
      </div>
      
      {lastAttempt && (
        <div style={{ marginBottom: '16px', fontSize: '12px', color: '#6c757d' }}>
          Last attempt: {lastAttempt}
        </div>
      )}
      
      {config?.targetControl && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={triggerAutoSelection}
            disabled={isLoading}
            style={{
              padding: '10px 16px',
              backgroundColor: isLoading ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
          >
            {isLoading ? 'Processing...' : 'Execute Selection'}
          </button>
          
          <button
            onClick={copyScript}
            style={{
              padding: '10px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
          >
            Copy Script
          </button>
        </div>
      )}
      
      {!config?.targetControl && (
        <div style={{
          padding: '16px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#856404'
        }}>
          <strong>Setup Required:</strong><br/>
          Please configure the target control ID in the plugin settings panel.
        </div>
      )}
      
      <details style={{ marginTop: '20px' }}>
        <summary style={{ 
          cursor: 'pointer', 
          padding: '8px 0',
          borderTop: '1px solid #e9ecef',
          fontSize: '14px',
          fontWeight: '500',
          color: '#6c757d'
        }}>
          Usage Instructions
        </summary>
        <div style={{
          padding: '12px 0',
          fontSize: '13px',
          lineHeight: '1.5',
          color: '#6c757d'
        }}>
          <ol style={{ paddingLeft: '20px', margin: 0 }}>
            <li>Enter the control ID of the dropdown you want to auto-select</li>
            <li>Enable "Trigger on Load" to automatically run when the workbook opens</li>
            <li>Set retry attempts for reliability</li>
            <li>Click "Execute Selection" to manually trigger</li>
            <li>Use "Copy Script" to get standalone JavaScript for console execution</li>
          </ol>
        </div>
      </details>
    </div>
  );
};

export default App;
