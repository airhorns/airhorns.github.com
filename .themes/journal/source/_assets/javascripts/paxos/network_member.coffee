Harry.NetworkMember =
  sendMessage: (destinationID, message) -> @network.sendMessage(@id, destinationID, message)
  broadcastMessage: (message) -> @network.broadcastMessage(@id, message)
  replyTimeout: 8000
  processMessage: ->
