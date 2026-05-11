#!/bin/bash

# Root folder
mkdir -p pocketsplit

# Server structure
mkdir -p pocketsplit/server/{routes,controllers,services,db,middleware,utils}

touch pocketsplit/server/index.js
touch pocketsplit/server/routes/index.js
touch pocketsplit/server/controllers/{groupController.js,memberController.js,expenseController.js,balanceController.js}
touch pocketsplit/server/services/{balanceService.js,txnIdService.js}
touch pocketsplit/server/db/{database.js,init.js,seed.js}
touch pocketsplit/server/middleware/errorHandler.js
touch pocketsplit/server/utils/validators.js

# Client structure
mkdir -p pocketsplit/client/{public,src/components,src/api}

touch pocketsplit/client/public/index.html
touch pocketsplit/client/src/{App.jsx,index.js,index.css,utils.js}
touch pocketsplit/client/src/api/api.js
touch pocketsplit/client/src/components/{Header.jsx,SummaryCards.jsx,ExpenseTimeline.jsx,ExpenseDetail.jsx,SettlementSuggestions.jsx,SettlementHistory.jsx,AddExpenseModal.jsx,GroupManager.jsx}

# Screenshots folder
mkdir -p pocketsplit/screenshots

# Root files
touch pocketsplit/pocketsplit.db
touch pocketsplit/package.json
touch pocketsplit/README.md

echo "Pocket Splitter project structure created successfully!"
