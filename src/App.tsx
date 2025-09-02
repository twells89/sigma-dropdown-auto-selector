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
  const [status, setStatus] = useState<string>('Plugin loaded successfully');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastAttempt, setLastAttempt] = useState<string>('');
  const [pluginClient, setPluginClient] = useState<any>(null);

  useEffect(() => {
    // Initialize plugin when window.sigma is available
    const initializePlugin = () => {
      try {
        // Check if we're in Sigma environment
        if ((window as any).sigma || (window as any).sigmaPlugin) {
          const sigma = (window as any).sigma || (window as any).sigmaPlugin;
          
          if (sigma && sigma.initialize) {
            const client = sigma.initialize();
            setPluginClient(client);
            
            // Configure editor panel
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
                name: 'instructions',
                type: 'text',
                multiline: true,
                defaultValue: 'This plugin monitors a dropdown control and automatically selects the first available option when the workbook loads or when triggered.',
                placeholder: 'Instructions for users'
              }
            ]);

            // Subscribe to config changes
            client.config.subscribe((newConfig: Partial<PluginConfig>) => {
              setConfig(newConfig);
              if (newConfig.targetControl) {
                setStatus(`Configured to monitor: ${newConfig.targetControl}`);
              }
            });

            setStatus('Connected to Sigma - ready for configuration');
            return;
          }
        }
        
        // Fallback for demo mode
        setStatus('Demo mode - configure settings below');
      } catch (error) {
        console.log('Plugin initialization:', error);
        setStatus('Demo mode - configure settings below');
      }
    };

    // Try multiple times as Sigma might load async
    initializePlugin();
    const interval = setInterval(() => {
      if (!pluginClient) {
        initializePlugin();
      } else {
        clearInterval(interval);
      }
    }, 1000);

    // Clean up after 10 seconds
    setTimeout(() => clearInterval(interval), 10000);
    
    return () => clearInterval(interval);
  }, [pluginClient]);

  const updateConfig = (key: keyof PluginConfig, value: any) => {
    if (pluginClient && pluginClient.config) {
      pluginClient.config.setKey(key, value);
    } else {
      setConfig(prev => ({ ...prev, [key]: value }));
    }
  };

  const createScript = (): string => {
    if (!config?.targetControl) return '';
    
    const retryAttempts = parseInt(config.retryAttempts || '3', 10);
    
    return `(function() {
  var CONFIG = {
    targetControlId: "${config.targetControl}",
    maxRetries: ${retryAttempts},
    retryDelay: 500,
    observerTimeout: 30000
  };

  var attempts = 0;
  
  function log(message) {
    console.log("[Sigma Auto-Selector]", message);
  }
  
  function selectFirstOption() {
    attempts++;
    log("Attempt " + attempts + " to find and select dropdown option");
    
    var dropdown = document.querySelector('[data-control-id="' + CONFIG.targetControlId + '"]');
    
    if (!dropdown) {
      dropdown = document.querySelector('[aria-label*="' + CONFIG.targetControlId + '"], [title*="' + CONFIG.targetControlId + '"]');
    }
    
    if (!dropdown) {
      var allDropdowns = Array.from(document.querySelectorAll('select, [role="combobox"], [role="listbox"], [class*="dropdown"], [class*="select"]'));
      
      for (var i = 0; i < allDropdowns.length; i++) {
        var el = allDropdowns[i];
        var parent = el.closest('[data-testid], [class*="control"], [class*="filter"]');
        if (parent && parent.textContent && parent.textContent.indexOf(CONFIG.targetControlId) >= 0) {
          dropdown = el;
          break;
        }
      }
    }
    
    if (dropdown) {
      log("Found dropdown element");
      
      if (dropdown.tagName === "SELECT") {
        if (dropdown.options && dropdown.options.length > 0) {
          var startIndex = (dropdown.options[0].value === "" || dropdown.options[0].textContent.trim() === "") ? 1 : 0;
          
          if (dropdown.options.length > startIndex) {
            dropdown.selectedIndex = startIndex;
            dropdown.dispatchEvent(new Event("change", { bubbles: true }));
            dropdown.dispatchEvent(new Event("input", { bubbles: true }));
            log('Selected option: "' + dropdown.options[startIndex].textContent + '"');
            return true;
          }
        }
      } else {
        dropdown.click();
        
        setTimeout(function() {
          var options = document.querySelectorAll('[role="option"], [data-value], .dropdown-item, .select-option, [class*="option"]');
          
          if (options.length > 0) {
            var visibleOptions = [];
            for (var j = 0; j < options.length; j++) {
              var option = options[j];
              var rect = option.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                visibleOptions.push(option);
              }
            }
            
            if (visibleOptions.length > 0) {
              var firstOption = visibleOptions[0];
              firstOption.click();
              log('Selected option: "' + (firstOption.textContent || "").trim() + '"');
              return true;
            }
          }
          
          log("No visible options found after opening dropdown");
          return false;
        }, 200);
        
        return true;
      }
    } else {
      log("Dropdown not found");
      return false;
    }
  }
  
  function trySelectWithRetry() {
    if (selectFirstOption()) {
      log("Selection completed successfully");
      return;
    }
    
    if (attempts < CONFIG.maxRetries) {
      log("Retrying in " + CONFIG.retryDelay + "ms... (attempt " + (attempts + 1) + "/" + CONFIG.maxRetries + ")");
      setTimeout(trySelectWithRetry, CONFIG.retryDelay);
    } else {
      log("Max retry attempts reached");
    }
  }
  
  log("Starting auto-selection process...");
  trySelectWithRetry();
})();`;
  };

  const executeSelection = () => {
    if (!config?.targetControl) {
      setStatus('Please enter a target control ID first');
      return;
    }

    setIsLoading(true);
    setStatus('Executing auto-selection...');
    setLastAttempt(new Date().toLocaleTimeString());
    
    try {
      // Use eval instead of script injection to avoid CSP issues
      const script = createScript();
      eval(script);
      
      setTimeout(() => {
        setStatus('Auto-selection executed');
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      setStatus('Error executing script: ' + (error as Error).message);
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    const script = createScript();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(script).then(() => {
        setStatus('Script copied to clipboard!');
        setTimeout(() => {
          setStatus('Ready');
        }, 2000);
      });
    } else {
      setStatus('Clipboard not available - script generated in console');
      console.log('Auto-selection script:', script);
    }
  };

  return (
    <div style={{
      padding: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '400px',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e1e5e9'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: config?.targetControl ? '#28a745' : '#ffc107',
          marginRight: '8px'
        }} />
        <h3 style={{ margin: 0, color: '#343a40', fontSize: '16px' }}>
          Dropdown Auto-Selector
        </h3>
      </div>
      
      <div style={{
        padding: '8px',
        backgroundColor: '#f8f9fa',
        borderLeft: '3px solid #007bff',
        marginBottom: '12px',
        fontSize: '12px',
        color: '#6c757d'
      }}>
        {config?.instructions || 'Automatically selects the first available dropdown option.'}
      </div>
      
      {!pluginClient && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
            Target Control ID:
          </label>
          <input
            type="text"
            placeholder="Enter control ID"
            value={config?.targetControl || ''}
            onChange={(e) => updateConfig('targetControl', e.target.value)}
            style={{
              width: '100%',
              padding: '6px',
              borderRadius: '4px',
              border: '1px solid #ced4da',
              fontSize: '12px',
              boxSizing: 'border-box'
            }}
          />
        </div>
      )}
      
      <div style={{ marginBottom: '8px' }}>
        <strong style={{ color: '#495057', fontSize: '12px' }}>Status:</strong>
        <div style={{
          marginTop: '2px',
          padding: '6px',
          backgroundColor: isLoading ? '#fff3cd' : '#d4edda',
          border: '1px solid ' + (isLoading ? '#ffeaa7' : '#c3e6cb'),
          borderRadius: '4px',
          color: isLoading ? '#856404' : '#155724',
          fontSize: '11px'
        }}>
          {status}
        </div>
      </div>
      
      {lastAttempt && (
        <div style={{ marginBottom: '8px', fontSize: '10px', color: '#6c757d' }}>
          Last attempt: {lastAttempt}
        </div>
      )}
      
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button
          onClick={executeSelection}
          disabled={isLoading || !config?.targetControl}
          style={{
            padding: '6px 12px',
            backgroundColor: (isLoading || !config?.targetControl) ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (isLoading || !config?.targetControl) ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            fontWeight: '500'
          }}
        >
          {isLoading ? 'Processing...' : 'Execute'}
        </button>
        
        <button
          onClick={copyToClipboard}
          disabled={!config?.targetControl}
          style={{
            padding: '6px 12px',
            backgroundColor: !config?.targetControl ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !config?.targetControl ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            fontWeight: '500'
          }}
        >
          Copy Script
        </button>
      </div>
    </div>
  );
};

export default App;
