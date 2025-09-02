import React, { useEffect, useState } from 'react';

declare global {
  interface Window {
    sigmaPlugin?: any;
    sigma?: any;
  }
}

const App: React.FC = () => {
  const [status, setStatus] = useState<string>('Initializing...');
  const [config, setConfig] = useState<any>({});
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    // Wait for Sigma to be available
    const checkForSigma = () => {
      // Try different ways Sigma might expose the plugin API
      const sigmaClient = window.sigmaPlugin || window.sigma || (window as any).SigmaPlugin;
      
      if (sigmaClient && typeof sigmaClient.initialize === 'function') {
        try {
          const pluginClient = sigmaClient.initialize();
          setClient(pluginClient);
          
          // Configure the plugin's settings panel
          pluginClient.config.configureEditorPanel([
            {
              name: 'targetControl',
              type: 'text',
              placeholder: 'Enter control ID to target'
            },
            {
              name: 'triggerOnLoad',
              type: 'toggle',
              defaultValue: true
            },
            {
              name: 'instructions',
              type: 'text',
              multiline: true,
              defaultValue: 'This plugin will attempt to select the first available option in the specified dropdown control.'
            }
          ]);

          // Listen for configuration changes
          pluginClient.config.subscribe((newConfig: any) => {
            setConfig(newConfig);
            setStatus(`Configured: ${newConfig.targetControl || 'No control specified'}`);
          });

          // Get initial config
          const initialConfig = pluginClient.config.get();
          setConfig(initialConfig || {});
          
          setStatus('Plugin connected to Sigma');
          
        } catch (error) {
          console.error('Error initializing Sigma plugin:', error);
          setStatus('Error connecting to Sigma: ' + (error as Error).message);
        }
      } else {
        setStatus('Waiting for Sigma plugin API...');
        return false;
      }
      return true;
    };

    // Try immediately
    if (!checkForSigma()) {
      // If not available, keep trying
      const interval = setInterval(() => {
        if (checkForSigma()) {
          clearInterval(interval);
        }
      }, 500);

      // Stop trying after 10 seconds
      setTimeout(() => {
        clearInterval(interval);
        if (!client) {
          setStatus('Sigma plugin API not available - running in demo mode');
        }
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [client]);

  const triggerAction = () => {
    setStatus('Triggering action - this would communicate with Sigma to select the first dropdown option');
    
    // In a real implementation, this would use Sigma's plugin API
    // to trigger actions or communicate with the workbook
    if (client && config.targetControl) {
      // Example of how this might work with Sigma's action system
      try {
        // This is hypothetical - actual API would depend on Sigma's implementation
        if (client.actions && typeof client.actions.trigger === 'function') {
          client.actions.trigger('selectFirstOption', {
            controlId: config.targetControl
          });
          setStatus('Action triggered successfully');
        } else {
          setStatus('Action API not available - logged to console');
          console.log('Would trigger action for control:', config.targetControl);
        }
      } catch (error) {
        setStatus('Error triggering action: ' + (error as Error).message);
      }
    } else {
      setStatus('No target control configured');
    }
  };

  return (
    <div style={{
      padding: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e1e5e9',
      maxWidth: '300px'
    }}>
      <h3 style={{ 
        margin: '0 0 12px 0', 
        color: '#343a40', 
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <span style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: client ? '#28a745' : '#ffc107',
          marginRight: '8px'
        }}></span>
        Dropdown Auto-Selector
      </h3>
      
      <div style={{
        padding: '8px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#6c757d',
        marginBottom: '12px'
      }}>
        {config.instructions || 'Configure this plugin using the settings panel to specify which dropdown control to target.'}
      </div>
      
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
          Target Control:
        </div>
        <div style={{
          padding: '6px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'monospace',
          color: config.targetControl ? '#28a745' : '#6c757d'
        }}>
          {config.targetControl || 'Not configured'}
        </div>
      </div>
      
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
          Status:
        </div>
        <div style={{
          padding: '6px',
          backgroundColor: client ? '#d4edda' : '#fff3cd',
          border: '1px solid ' + (client ? '#c3e6cb' : '#ffeaa7'),
          borderRadius: '4px',
          fontSize: '11px',
          color: client ? '#155724' : '#856404'
        }}>
          {status}
        </div>
      </div>
      
      <button
        onClick={triggerAction}
        disabled={!config.targetControl}
        style={{
          width: '100%',
          padding: '8px 12px',
          backgroundColor: !config.targetControl ? '#6c757d' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: !config.targetControl ? 'not-allowed' : 'pointer'
        }}
      >
        Trigger Auto-Selection
      </button>
      
      {!client && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          backgroundColor: '#e7f3ff',
          border: '1px solid #b6d7ff',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#004085'
        }}>
          <strong>Note:</strong> This plugin requires Sigma's plugin API to function properly. 
          Configure the target control ID in the plugin settings panel.
        </div>
      )}
    </div>
  );
};

export default App;
