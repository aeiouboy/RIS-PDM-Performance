const AzureDevOpsService = require('./src/services/azureDevOpsService');
const { azureDevOpsConfig } = require('./src/config/azureDevOpsConfig');
const service = new AzureDevOpsService(azureDevOpsConfig);

async function debugUserWorkItems() {
  try {
    const userId = 'intawatchai@central.co.th';

    // Get work items for this user
    const workItems = await service.getUserWorkItems(userId, {
      sprintId: 'delivery-5',
      productId: 'Product - Partner Management Platform'
    });

    console.log('=== WORK ITEMS FOR DELIVERY-5 ===');
    console.log('Total work items:', workItems.length);

    // Group by iteration path and calculate story points
    const byIteration = {};
    workItems.forEach(item => {
      const iterationPath = item.iterationPath || 'No Sprint';
      const iterationName = iterationPath.split('\\').pop() || iterationPath;

      if (!byIteration[iterationName]) {
        byIteration[iterationName] = {
          items: [],
          totalStoryPoints: 0,
          completedStoryPoints: 0
        };
      }

      byIteration[iterationName].items.push({
        id: item.id,
        title: item.title.substring(0, 50) + '...',
        storyPoints: item.storyPoints,
        state: item.state,
        iterationPath: item.iterationPath,
        workItemType: item.type
      });

      byIteration[iterationName].totalStoryPoints += item.storyPoints || 0;
      if (item.state === 'Done' || item.state === 'Closed') {
        byIteration[iterationName].completedStoryPoints += item.storyPoints || 0;
      }
    });

    console.log('\n=== BY ITERATION ===');
    Object.entries(byIteration).forEach(([iteration, data]) => {
      console.log(`\n${iteration}:`);
      console.log(`  Total Story Points: ${data.totalStoryPoints}`);
      console.log(`  Completed Story Points: ${data.completedStoryPoints}`);
      console.log(`  Item Count: ${data.items.length}`);

      if (iteration.includes('Delivery 5') || iteration.includes('Speed Run Sprint 7')) {
        console.log('  Sample Items:');
        data.items.slice(0, 10).forEach(item => {
          console.log(`    - ${item.id}: ${item.title} [${item.storyPoints} pts, ${item.state}, ${item.workItemType}]`);
        });
      }
    });

    // Now let's see what getUserPerformanceHistory returns
    console.log('\n=== PERFORMANCE HISTORY ===');
    const performanceHistory = await service.getUserPerformanceHistory(userId, { timeRange: '4sprints' });

    performanceHistory.forEach(period => {
      console.log(`\nPeriod: ${period.iterationPath}`);
      console.log(`  Total Story Points: ${period.storyPoints}`);
      console.log(`  Completed Story Points: ${period.completedStoryPoints}`);
      console.log(`  Velocity: ${period.velocity}`);
      console.log(`  Work Items Count: ${period.workItems ? period.workItems.length : 'N/A'}`);

      if (period.workItems && period.workItems.length > 0) {
        console.log(`  Sample Work Items:`);
        period.workItems.slice(0, 5).forEach(item => {
          console.log(`    - ${item.id}: ${item.title.substring(0, 30)}... [${item.storyPoints} pts, ${item.state}]`);
        });
      }
    });

    // Test the individual metrics API to see Recent Work Items count
    console.log('\n=== TESTING INDIVIDUAL METRICS API ===');
    const MetricsCalculatorService = require('./src/services/metricsCalculator');
    const metricsService = new MetricsCalculatorService();

    const individualMetrics = await metricsService.calculateIndividualMetrics(userId, {
      productId: 'Product - Partner Management Platform',
      sprintId: 'delivery-5'
    });

    console.log('Recent Work Items Count:', individualMetrics.workItems.recent.length);
    console.log('Total Work Items Count:', individualMetrics.workItems.total);
    console.log('Total Story Points:', individualMetrics.performance.totalAssignedStoryPoints);
    console.log('Completed Story Points:', individualMetrics.performance.completedStoryPoints);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

debugUserWorkItems().then(() => {
  console.log('\nDebugging complete');
}).catch(console.error);