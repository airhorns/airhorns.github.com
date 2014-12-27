Harry.NetworkMember =

  sendMessage: (destinationID, message) ->
    @network.sendMessage(@id, destinationID, @prepareMessage(message))

  broadcastMessage: (message) ->
    @network.broadcastMessage(@id, @prepareMessage(message))

  prepareMessage: (message) ->
    message.roundNumber = @roundNumber
    return message

  startNewRound: (roundNumber) -> @roundNumber = roundNumber

  processMessage: ->

  replyTimeout: 8000
  fixed: true
