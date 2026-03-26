#= require paxos/network_member

class Harry.Replica extends Batman.StateMachine
  @transitions
    startSet: {'idle': 'awaiting-promises', 'awaiting-promises': 'awaiting-promises'}
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
    clearTimeout(@timeout) if @timeout?
    @set 'highestSeenSequenceNumber', 0
    if @get('state') != 'muted'
      @set '_state', 'idle'
    delete @roundAttempt

  processMessage: (message) ->
    return unless message.roundNumber == @roundNumber
    switch message.constructor
      when Harry.QueryMessage           then @queryReceived(message)
      when Harry.PrepareMessage         then @prepareReceived(message)
      when Harry.AcceptMessage          then @acceptReceived(message)
      when Harry.SetValueMessage        then @setRequestReceived(message)
      when Harry.PromiseMessage         then @promiseReceived(message)
      when Harry.RejectProposalMessage  then @promiseRejectionReceived(message)

  # Messages triggered by clients which cause round leadership
  setRequestReceived: (message) ->
    @setValue message.value, (error) =>
      @sendMessage message.sender, new Harry.SetValueResultMessage(error)

  queryReceived: (message) ->
    @sendMessage message.sender, new Harry.QueryResponseMessage(@value)

  setValue: (value, callback) ->
    if @get('value')? and @get('value') != value
      callback("Can't set a new value if one has already been accepted")
      return false

    @set('highestSeenSequenceNumber', @_nextSequenceNumber())
    @roundAttempt =
      sequenceNumber: @get('highestSeenSequenceNumber')
      callback: callback
      value: value
      promisesReceived: 0

    @startTransition 'startSet'
    return @get('isAwaiting-promises')

  promiseReceived: (message) ->
    if @roundAttempt?
      # Detect previous acceptances and abort if underway
      if message.value?
        if message.value != @roundAttempt.value
          @startTransition 'proposalFailed'
          return

      @roundAttempt.promisesReceived += 1
      if @roundAttempt.promisesReceived >= @quorum
        @startTransition 'proposalSucceeded'

  promiseRejectionReceived: ->
    @startTransition 'proposalFailed'

  # State transitions caused by round leadership
  @::on 'startSet', ->
    @broadcastMessage new Harry.PrepareMessage(@roundAttempt.sequenceNumber, @roundAttempt.value)

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
    roundAttempt?.callback? new Error("value not written")

  @::on 'proposalSucceeded', 'mute', ->
    clearTimeout(@timeout)

  # Actions caused by roundAttempt membership
  prepareReceived: (message) ->
    if message.sequenceNumber > @get('highestSeenSequenceNumber')
      @set('highestSeenSequenceNumber', message.sequenceNumber)
      # Fail my current proposal if there is a newer one on the loose
      if @get('isAwaiting-promises')
        @startTransition 'proposalFailed'
      response = new Harry.PromiseMessage(@get('value'))
      shouldStage = !@get('value')? || @get('value') == message.value
    else
      response = new Harry.RejectProposalMessage(@get('highestSeenSequenceNumber'))
      shouldStage = false

    @sendMessage(message.sender, response)
    return shouldStage

  acceptReceived: (message) ->
    if message.sequenceNumber >= @get('highestSeenSequenceNumber')
      # Fail my current proposal if there is a newer one on the loose
      if @get('isAwaiting-promises')
        @startTransition 'proposalFailed'
      @set('highestSeenSequenceNumber', message.sequenceNumber)
      @set 'value', message.value

  _nextSequenceNumber: ->
    rounds = Math.floor(@get('highestSeenSequenceNumber') / @network.replicaCount)
    base = rounds * @network.replicaCount
    return base + @id

  sendMessage: ->
    return false if @get('isMuted')
    Harry.NetworkMember.sendMessage.apply(this, arguments)


class Harry.TimePrecedenceReplica extends Harry.Replica
  prepareReceived: (message) ->
    if @get('isAwaiting-promises')
      @startTransition 'proposalFailed'
    response = new Harry.PromiseMessage()

    @sendMessage(message.sender, response)
    true
