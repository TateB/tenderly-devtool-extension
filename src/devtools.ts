chrome.devtools.panels.create(
    "Tenderly",
    "", // No icon for now
    "panel.html",
    function(panel) {
      // Listen for test automation trigger to activate panel
      chrome.storage.onChanged.addListener((changes) => {
        if (changes._test_activate_panel?.newValue === true) {
          panel.show();
          // Reset the trigger
          chrome.storage.local.remove('_test_activate_panel');
        }
      });
    }
);

