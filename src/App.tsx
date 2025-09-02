import React, { useEffect, useState } from 'react';

interface PluginConfig {
  targetControl: string;
  autoTrigger: boolean;
  instructions: string;
  triggerOnLoad: boolean;
  retryAttempts: string;
}

const App: React.FC = () => {
  const [config, setConfig] = useState<Partial<PluginConfig>>({
    targetControl: '',
    autoTrigger: true,
    instructions: 'This plugin monitors a dropdown control and automatically selects the first available option when the workbook loads or when triggered.',
    triggerOnLoad: true,
    retryAttempts: '3'
  });
  const [status, setStatus] = useState<string>('Ready for configuration...');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastAttempt, setLastAttempt] = useState<string>('');
  const [pluginClient, setPluginClient] = useState<any>(null);

  useEffect(() => {
    // Try to initialize the Sigma plugin when available
    const initializePlugin = async () => {
      try {
        // Use dynamic import with any type to avoid TypeScript issues
        const sigmaPlugin: any = await import('@sigmacomputing/plugin');
        
        // Try different ways to find the initialize function
        let initialize: any = null;
        
        if (sigmaPlugin) {
          initialize = sigmaPlugin.initialize ||
                      sigmaPlugin.default?.initialize ||
                      sigmaPlugin.Client?.initialize ||
                      (window as any).sigmaPlugin?.initialize;
        }

        if (initialize && typeof initialize === 'function') {
          const client = initialize();
          setPluginClient(client);
          
          // Configure the editor panel
          if (client && client.config && typeof client.config.configureEditorPanel === 'function') {
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

            // Subscribe to config changes
            if (typeof client.config.subscribe === 'function') {
              client.config.subscribe((newConfig: Partial<PluginConfig>) => {
                setConfig(newConfig);
                if (newConfig.targetControl) {
                  setStatus(`Configured to monitor: ${newConfig.targetControl}`);
                }
              });
            }
          }

          setStatus('Plugin initialized successfully');
        } else {
          throw new Error('Initialize function not found');
        }
      } catch (error) {
        console.log('Sigma plugin not available, running in demo mode:', error);
        setStatus('Running in demo mode - configure settings below');
      }
    };

    initializePlugin();
  }, []);

  // Handle manual config updates when not connected to Sigma
  const updateConfig = (key: keyof PluginConfig, value: any) => {
    if (pluginClient && pluginClient.config && typeof pluginClient.config.setKey === 'function') {
      pluginClient.config.setKey(key, value);
    } else {
      setConfig(prev => ({ ...prev, [key]: value }));
    }
  };

  const generateControlScript = (): string => {
    if (!config?.targetControl) return '';
    
    const retryAttempts = parseInt(config.retryAttempts || '3', 10);
    
    return `// Sigma Dropdown Auto-Selector Script
// Target Control: ${config.targetControl}
// Generated: ${new Date().toISOString()}

(function() {
  var CONFIG = {
    targetControlId: '${config.targetControl}',
    maxRetries: ${retryAttempts},
    retryDelay: 500,
    observerTimeout: 30000
  };

  var attempts = 0;
  
  function log(message) {
    console.log('[Sigma Auto-Selector]', message);
  }
  
  function selectFirstOption() {
    attempts++;
    log('Attempt ' + attempts + ' to find and select dropdown option');
    
    // Strategy 1: Look for control by data attribute
    var dropdown = document.querySelector('[data-control-id="' + CONFIG.targetControlId + '"]');
    
    if (!dropdown) {
      // Strategy 2: Look for control by aria-label or title
      dropdown = document.querySelector('[aria-label*="' + CONFIG.targetControlId + '"], [title*="' + CONFIG.targetControlId + '"]');
    }
    
    if (!dropdown) {
      // Strategy 3: Look for any dropdown in proximity
      var allDropdowns = Array.from(document.querySelectorAll('select, [role="combobox"], [role="listbox"], [class*="dropdown"], [class*="select"]'));
      
      dropdown = allDropdowns.find(function(el) {
        var parent = el.closest('[data-testid], [class*="control"], [class*="filter"]');
        return parent && (parent.textContent || '').includes(CONFIG.targetControlId);
      });
    }
    
    if (dropdown) {
      log('Found dropdown element:', dropdown);
      
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
      var startIndex = (select.options[0].value === '' || select.options[0].textContent.trim() === '') ? 1 : 0;
      
      if (select.options.length > startIndex) {
        select.selectedIndex = startIndex;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select.dispatchEvent(new Event('input', { bubbles: true }));
        log('Selected option: "' + select.options[startIndex].textContent + '"');
        return true;
      }
    }
    return false;
  }
  
  function handleCustomDropdown(dropdown) {
    dropdown.click();
    
    setTimeout(function() {
      var options = document.querySelectorAll('[role="option"], [data-value], .dropdown-item, .select-option, [class*="option"]');
      
      if (options.length > 0) {
        var visibleOptions = Array.from(options).filter(function(option) {
          var rect = option.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        
        if (visibleOptions.length > 0) {
          var firstOption = visibleOptions[0];
          firstOption.click();
          log('Selected option: "' + (firstOption.textContent || '').trim() + '"');
          return true;
        }
      }
      
      log('No visible options found after opening dropdown');
      return false;
    }, 200);
    
    return true;
  }
  
  function trySelectWithRetry() {
    if (selectFirstOption()) {
      log('Selection completed successfully');
      return;
    }
    
    if (attempts < CONFIG.maxRetries) {
      log('Retrying in ' + CONFIG.retryDelay + 'ms... (attempt ' + (attempts + 1) + '/' + CONFIG.maxRetries + ')');
      setTimeout(trySelectWithRetry, CONFIG.retryDelay);
    } else {
      log('Max retry attempts reached. Setting up DOM observer...');
      setupDOMObserver();
    }
  }
  
  function setupDOMObserver() {
    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
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
    
    setTimeout(function() {
      observer.disconnect();
      log('DOM observer timeout reached');
    }, CONFIG.observerTimeout);
  }
  
  log('Starting auto-selection process...');
  trySelectWithRetry();
})();`;
  };

  const copyScript = (): void => {
    const script = generateControlScript();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(script).then(() => {
        setStatus('Script copied to clipboard!');
        setTimeout(() => {
          setStatus(`Ready - monitoring: ${config?.targetControl || 'demo'}`);
        }, 2000);
      });
    } else {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = script;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setStatus('Script copied to clipboard!');
    }
  };

  const triggerAutoSelection = (): void => {
    if (!config?.targetControl) {
      setStatus('Please enter a target control ID first');
      return;
    }

    setIsLoading(true);
    setStatus('Executing auto-selection...');
    setLastAttempt(new Date().toLocaleTimeString());
    
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
      border: '1px solid #e1e5e9',
      margin: '0 auto'
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
      
      <div style={{
        padding: '12px',
        backgroundColor: '#f8f9fa',
        borderLeft: '3px solid #007bff',
        marginBottom: '16px',
        fontSize: '14px',
        lineHeight: '1.4',
        color: '#6c757d'
      }}>
        {config?.instructions || 'This plugin monitors a dropdown control and automatically selects the first available option when the workbook loads or when triggered.'}
      </div>
      
      {!pluginClient && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#495057' }}>
            Target Control ID:
          </label>
          <input
            type="text"
            placeholder="Enter control ID (e.g., dropdown-1)"
            value={config?.targetControl || ''}
            onChange={(e) => updateConfig('targetControl', e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ced4da',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
          <small style={{ color: '#6c757d', fontSize: '12px' }}>
            Find this in your Sigma workbook by inspecting the dropdown control element
          </small>
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
          color: config?.targetControl ? '#28a745' : '#6c757d',
          wordBreak: 'break-all'
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
          border: '1px solid ' + (isLoading ? '#ffeaa7' : '#c3e6cb'),
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
      
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button
          onClick={triggerAutoSelection}
          disabled={isLoading || !config?.targetControl}
          style={{
            padding: '10px 16px',
            backgroundColor: (isLoading || !config?.targetControl) ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: (isLoading || !config?.targetControl) ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s',
            flex: '1',
            minWidth: '120px'
          }}
        >
          {isLoading ? 'Processing...' : 'Execute Selection'}
        </button>
        
        <button
          onClick={copyScript}
          disabled={!config?.targetControl}
          style={{
            padding: '10px 16px',
            backgroundColor: !config?.targetControl ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: !config?.targetControl ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s',
            flex: '1',
            minWidth: '100px'
          }}
        >
          Copy Script
        </button>
      </div>
      
      {!pluginClient && (
        <div style={{
          padding: '16px',
          backgroundColor: '#e7f3ff',
          border: '1px solid #b6d7ff',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#004085',
          marginBottom: '16px'
        }}>
          <strong>Demo Mode:</strong><br/>
          This plugin is running in demo mode. When deployed in Sigma, configuration will be handled through the plugin settings panel.
        </div>
      )}
      
      <details style={{ marginTop: '16px' }}>
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
            <li><strong>Find Control ID:</strong> In Sigma, inspect your dropdown control element to find its ID</li>
            <li><strong>Configure:</strong> Enter the control ID in the field above (demo mode) or plugin settings (when deployed)</li>
            <li><strong>Test:</strong> Click "Execute Selection" to test the auto-selection manually</li>
            <li><strong>Deploy:</strong> Use "Copy Script" to get standalone JavaScript for other implementations</li>
            <li><strong>Auto-trigger:</strong> When deployed in Sigma, enable "Trigger on Load" in settings for automatic selection</li>
          </ol>
        </div>
      </details>
    </div>
  );
};

export default App;
