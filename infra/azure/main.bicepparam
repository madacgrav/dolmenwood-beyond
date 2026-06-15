using './main.bicep'

param environment = 'prod'
param projectName = 'dolmenwood'

// The two values below are ALWAYS overridden by inline parameters in
// .github/workflows/deploy-azure.yml (imageTag=… supabaseUrl=…).
// They exist only because bicepparam requires every required parameter
// to be assigned. Do not put a real project ref here.
param imageTag = 'latest'
param supabaseUrl = 'https://OVERRIDDEN-BY-WORKFLOW.supabase.co'
