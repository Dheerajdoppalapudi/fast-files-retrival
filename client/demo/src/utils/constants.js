export const mainFolders = [
  { name: 'Projects', modified: 'Jun 18, 2024', size: '-', hasVersions: false },
  { name: 'Reports', modified: 'Dec 03, 2023', size: '-', hasVersions: false },
  { name: 'Invoices', modified: 'Oct 13, 2023', size: '-', hasVersions: false },
  { name: 'Contracts', modified: 'May 07, 2023', size: '-', hasVersions: false },
  { name: 'Financials', modified: 'Jun 05, 2022', size: '-', hasVersions: false },
];

// Enhanced with version information
export const projectsFolders = [
  { 
    name: 'Project_Plan.pdf', 
    modified: 'Jun 18, 2024', 
    size: '1.2 MB', 
    hasVersions: true,
    versions: [
      { version: 'v3', modified: 'Jun 18, 2024', size: '1.2 MB', author: 'John Doe', notes: 'Final version with stakeholder feedback incorporated',approved:false },
      { version: 'v2', modified: 'Jun 15, 2024', size: '1.1 MB', author: 'John Doe', notes: 'Updated timeline and resource allocation',approved:true },
      { version: 'v1', modified: 'Jun 10, 2024', size: '1.0 MB', author: 'Jane Smith', notes: 'Initial draft',approved:true }
    ]
  },
  { 
    name: 'Budget_Estimate.xlsx', 
    modified: 'Jun 18, 2024', 
    size: '850 KB', 
    hasVersions: true,
    versions: [
      { version: 'v4', modified: 'Jun 18, 2024', size: '850 KB', author: 'Alex Johnson', notes: 'Final budget approved by finance' ,approved:false},
      { version: 'v3', modified: 'Jun 14, 2024', size: '820 KB', author: 'Alex Johnson', notes: 'Updated with new vendor quotes' ,approved:true},
      { version: 'v2', modified: 'Jun 07, 2024', size: '790 KB', author: 'Michael Brown', notes: 'Added contingency expenses',approved:true },
      { version: 'v1', modified: 'Jun 01, 2024', size: '750 KB', author: 'Alex Johnson', notes: 'Initial draft',approved:true }
    ]
  },
  { name: 'Meeting_Minutes.docx', modified: 'Jun 18, 2024', size: '320 KB', hasVersions: false },
  { 
    name: 'Risk_Assessment.pdf', 
    modified: 'Jun 18, 2024', 
    size: '1.5 MB', 
    hasVersions: true,
    versions: [
      { version: 'v3', modified: 'Jun 18, 2024', size: '1.5 MB', author: 'Sarah Williams', notes: 'Updated with new risk factors',approved:false, restore:{
        version: 'v2', modified: 'Jun 18, 2024', size: '1.5 MB', author: 'Sarah Williams', notes: 'Updated with new risk factors',approved:true
      }},
      { version: 'v2', modified: 'Jun 18, 2024', size: '1.5 MB', author: 'Sarah Williams', notes: 'Updated with new risk factors',approved:true,restore:false },
      { version: 'v1', modified: 'Jun 05, 2024', size: '1.3 MB', author: 'Sarah Williams', notes: 'Initial assessment',approved:true }
    ]
  },
  { name: 'Timeline_Gantt_Chart.pptx', modified: 'Jun 18, 2024', size: '2.1 MB', hasVersions: false },
  { name: 'Stakeholder_List.xlsx', modified: 'Jan 06, 2024', size: '450 KB', hasVersions: false },
  { 
    name: 'Project_Status_Report.pdf', 
    modified: 'Jan 06, 2024', 
    size: '1.8 MB', 
    hasVersions: true,
    versions: [
      
      { version: 'v3', modified: 'Jan 06, 2024', size: '1.8 MB', author: 'John Doe', notes: 'Q4 status update',approved:false },
      { version: 'v2', modified: 'Oct 15, 2023', size: '1.6 MB', author: 'John Doe', notes: 'Q3 status update',approved:true },
      { version: 'v1', modified: 'Jul 12, 2023', size: '1.5 MB', author: 'Jane Smith', notes: 'Q2 status update' ,approved:true}


    ]
  },
];