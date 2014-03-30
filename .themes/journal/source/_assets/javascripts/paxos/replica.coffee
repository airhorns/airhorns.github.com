#= require paxos/network_member

class Harry.Replica extends Batman.StateMachine
  @transitions
    startSet: {idle: 'awaiting-promises'}
    proposalSucceeded: {'awaiting-promises': 'idle'}
    proposalFailed: {'awaiting-promises': 'idle'}
    mute:
      from: ['idle', 'awaiting-promises']
      to: 'muted'
    unmute: {muted: 'idle'}

  @::mixin Harry.NetworkMember

  constructor: (@id, @quorum, @network) ->
    super('idle')

  startNewRound: (roundNumber) ->
    @roundNumber = roundNumber
    @set 'value', null
    @set 'highestSeenSequenceNumber', 0
    delete @roundAttempt

  processMessage: (message) ->
    return unless message.roundNumber == @roundNumber

    switch @get('state')
      when 'awaiting-promises'
        switch message.constructor
          when Harry.PromiseMessage         then @promiseReceived(message)
          when Harry.RejectProposalMessage  then @promiseRejectionReceived(message)
      when 'idle'
        switch message.constructor
          when Harry.QueryMessage           then @queryReceived(message)
          when Harry.PrepareMessage         then @prepareReceived(message)
          when Harry.AcceptMessage          then @acceptReceived(message)
          when Harry.SetValueMessage        then @setRequestReceived(message)

  # Messages triggered by clients which cause round leadership
  setRequestReceived: (message) ->
    @setValue message.value, (error) =>
      @sendMessage message.sender, new Harry.SetValueResultMessage(error)

  queryReceived: (message) -> @sendMessage(message.sender, new Harry.QueryResponseMessage(@value))

  setValue: (value, callback) ->
    @set('highestSeenSequenceNumber', @get('highestSeenSequenceNumber') + 1)
    @roundAttempt =
      sequenceNumber: @get('highestSeenSequenceNumber')
      callback: callback
      value: value
      promisesReceived: 0
      roundNumber: (ROUND_NUMBER += 1)

    @startTransition 'startSet'

  getValue: ->

  promiseReceived: ->
    @roundAttempt.promisesReceived += 1
    if @roundAttempt.promisesReceived >= @quorum
      @startTransition 'proposalSucceeded'

  promiseRejectionReceived: ->
    @startTransition 'proposalFailed'

  # State transitions caused by round leadership
  @::on 'startSet', ->
    @broadcastMessage new Harry.PrepareMessage(@roundAttempt.sequenceNumber)

    @timeout = setTimeout =>
      @startTransition('proposalFailed') if @get('isAwaiting-promises')
    , @replyTimeout

  @::on 'proposalSucceeded', ->
    @broadcastMessage new Harry.AcceptMessage(@roundAttempt.sequenceNumber, @roundAttempt.value)
    @set 'value', @roundAttempt.value
    roundAttempt = @roundAttempt
    delete @roundAttempt
    roundAttempt.callback?()

  @::on 'proposalFailed', ->
    roundAttempt = @roundAttempt
    delete @roundAttempt
    roundAttempt.callback? new Error("value not written")

  @::on 'proposalSucceeded', 'mute', ->
    clearTimeout(@timeout)

  # Actions caused by roundAttempt membership
  prepareReceived: (message) ->
    response = if message.sequenceNumber > @get('highestSeenSequenceNumber')
      @set('highestSeenSequenceNumber', message.sequenceNumber)
      new Harry.PromiseMessage()
    else
      new Harry.RejectProposalMessage(@get('highestSeenSequenceNumber'))
    @sendMessage(message.sender, response)

  acceptReceived: (message) ->
    if message.sequenceNumber >= @get('highestSeenSequenceNumber')
      @set('highestSeenSequenceNumber', message.sequenceNumber)
      @set 'value', message.value
