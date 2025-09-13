document.addEventListener('DOMContentLoaded', function() {
  // Toggle collapsible sections
  const collapsibles = document.querySelectorAll('.collapsible');
  
  collapsibles.forEach(section => {
    const content = section;
    const header = section.querySelector('h3');
    
    // Add click handler to header
    header.addEventListener('click', () => {
      // Toggle active class
      section.classList.toggle('active');
      
      // Toggle content visibility
      const content = section;
      content.style.maxHeight = content.style.maxHeight ? null : content.scrollHeight + 'px';
    });
  });
  
  // Toggle travel modes
  const travelModes = document.querySelectorAll('.travel-modes .mode');
  travelModes.forEach(mode => {
    mode.addEventListener('click', () => {
      // Remove active class from all modes
      travelModes.forEach(m => m.classList.remove('active'));
      // Add active class to clicked mode
      mode.classList.add('active');
      
      // Trigger mode change event
      const modeValue = mode.getAttribute('data-mode');
      document.dispatchEvent(new CustomEvent('travelModeChange', { detail: { mode: modeValue } }));
    });
  });
  
  // Toggle layer chips
  const layerChips = document.querySelectorAll('.chips .chip');
  layerChips.forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      
      // Trigger layer toggle event
      const layer = chip.getAttribute('data-layer');
      const isActive = chip.classList.contains('active');
      document.dispatchEvent(new CustomEvent('layerToggle', { 
        detail: { 
          layer: layer, 
          visible: isActive 
        } 
      }));
    });
  });
  
  // Initialize collapsibles to be closed by default
  collapsibles.forEach(section => {
    section.classList.add('active'); // Start with all sections open
  });
});