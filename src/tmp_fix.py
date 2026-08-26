import os

filepath = '/home/developer/rohitworkspace/prod/marketing-automation/marketing-automation-frontend/src/pages/admin/ApprovalFlowMasterPage.jsx'

with open(filepath, 'r') as f:
    content = f.read()

# State
content = content.replace("  const [rejectionRoutingType, setRejectionRoutingType] = useState('RETURN_TO_CREATOR')\n", "")

# openCreateModal
content = content.replace("    setRejectionRoutingType('RETURN_TO_CREATOR')\n", "")
content = content.replace("skipIfNoApprover: false, fallbackAction: 'PAUSE'", "")

# openEditModal
content = content.replace("      setRejectionRoutingType(data.rejectionRoutingType)\n", "")

# handleClone
content = content.replace("      setRejectionRoutingType(data.rejectionRoutingType)\n", "")

# handleSave
content = content.replace("""    const lastLevel = levels[levels.length - 1]
    if (lastLevel.skipIfNoApprover) {
      toast.error('The final level cannot have "Skip if no approver" enabled.')
      return
    }""", "")
content = content.replace("const payload = { name, description, rejectionRoutingType, levels }", "const payload = { name, description, levels }")

with open(filepath, 'w') as f:
    f.write(content)
