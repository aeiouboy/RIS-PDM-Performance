#!/usr/bin/env node

// Debug script to test DaaS user work items
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

const AzureDevOpsService = require('./backend/src/services/azureDevOpsService');
const MetricsCalculator = require('./backend/src/services/metricsCalculator');

async function debugDaaSUser() {
  console.log('🔍 Debugging DaaS User Work Items...');

  const userId = 'sirithanakorn@central.co.th';
  const productId = 'Product - Data as a Service';
  const sprintId = 'delivery-13';

  console.log('📊 Testing with:');
  console.log(`  User: ${userId}`);
  console.log(`  Product: ${productId}`);
  console.log(`  Sprint: ${sprintId}`);
  console.log('');

  try {
    // Initialize services
    const azureService = new AzureDevOpsService();
    const metricsCalculator = new MetricsCalculator(azureService);

    console.log('🔗 Step 1: Test direct Azure service call...');
    const directWorkItems = await azureService.getUserWorkItems(userId, {
      productId,
      sprintId,
      iterationPath: 'Product - Data as a Service\\Delivery 13'
    });
    console.log(`✅ Direct Azure call returned ${directWorkItems.length} work items`);

    if (directWorkItems.length > 0) {
      console.log('📋 Sample work items:');
      directWorkItems.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i+1}. ${item.title} (${item.type}) - ${item.state}`);
        console.log(`      IterationPath: ${item.iterationPath}`);
      });
    }
    console.log('');

    console.log('🧮 Step 2: Test metrics calculator...');
    const individualMetrics = await metricsCalculator.calculateIndividualMetrics(userId, {
      productId,
      sprintId,
      iterationPath: 'Product - Data as a Service\\Delivery 13'
    });

    console.log(`✅ Metrics calculator returned:`);
    console.log(`  Recent work items: ${individualMetrics.workItems?.recent?.length || 0}`);
    console.log(`  Performance data: ${JSON.stringify(individualMetrics.performance, null, 2)}`);

    if (individualMetrics.workItems?.recent?.length > 0) {
      console.log('📋 Recent work items from metrics:');
      individualMetrics.workItems.recent.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i+1}. ${item.title} (${item.type}) - ${item.state}`);
      });
    } else {
      console.log('❌ No recent work items found in metrics result!');
    }

    console.log('');
    console.log('🔍 Step 3: Test without sprint filtering...');
    const unfiltered = await azureService.getUserWorkItems(userId, {
      productId
      // No sprint filtering
    });
    console.log(`✅ Unfiltered call returned ${unfiltered.length} work items`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

debugDaaSUser().catch(console.error);