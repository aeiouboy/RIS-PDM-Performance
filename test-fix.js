#!/usr/bin/env node

// Test script to verify DaaS iteration path fix
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

const AzureDevOpsService = require('./backend/src/services/azureDevOpsService');

async function testFix() {
  console.log('🧪 Testing DaaS Iteration Path Fix...');

  const userId = 'sirithanakorn@central.co.th';
  const productId = 'Product - Data as a Service';
  const sprintId = 'delivery-13';

  console.log('📊 Testing with:');
  console.log(`  User: ${userId}`);
  console.log(`  Product: ${productId}`);
  console.log(`  Sprint: ${sprintId}`);
  console.log('');

  try {
    const azureService = new AzureDevOpsService();

    console.log('🔍 Step 1: Test sprint ID resolution...');
    const resolvedPath = await azureService.resolveSprintToIterationPath(productId, sprintId);
    console.log(`✅ Resolved "${sprintId}" to: "${resolvedPath}"`);
    console.log('');

    console.log('🔗 Step 2: Test getUserWorkItems with sprintId (should auto-resolve)...');
    const workItems = await azureService.getUserWorkItems(userId, {
      productId,
      sprintId
      // No iterationPath - should auto-resolve from sprintId
    });
    console.log(`✅ getUserWorkItems returned ${workItems.length} work items`);

    if (workItems.length > 0) {
      console.log('📋 Sample work items:');
      workItems.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i+1}. ${item.title} (${item.type}) - ${item.state}`);
        console.log(`      IterationPath: ${item.iterationPath}`);
      });
    }

    console.log('');
    console.log('🎉 Fix working! DaaS users should now see Task Distribution and Recent Work Items.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testFix().catch(console.error);