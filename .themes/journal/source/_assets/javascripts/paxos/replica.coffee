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
    @set 'value', null
    @set 'highestSeenSequenceNumber', 0

  setValue: (value, callback) ->
    @set('highestSeenSequenceNumber', @get('highestSeenSequenceNumber') + 1)
    @round = new Harry.Round
      sequenceNumber: @get('highestSeenSequenceNumber')
      callback: callback
      value: value
      promisesReceived: 0

    @startTransition 'startSet'

  getValue: ->

  processMessage: (message) ->
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

  @::on 'startSet', ->
    @broadcastMessage new Harry.PrepareMessage(@round.sequenceNumber)

    @timeout = setTimeout =>
      @startTransition('proposalFailed') if @get('isAwaiting-promises')
    , @replyTimeout

  @::on 'proposalSucceeded', ->
    @broadcastMessage new Harry.AcceptMessage(@round.sequenceNumber, @round.value)
    @set 'value', @round.value
    round = @round
    delete @round
    round.callback?()

  @::on 'proposalFailed', ->
    round = @round
    delete @round
    round.callback? new Error("value not written")

  @::on 'proposalSucceeded', 'mute', ->
    clearTimeout(@timeout)

  setRequestReceived: (message) ->
    @setValue message.value, (error) =>
      @sendMessage message.sender, new Harry.SetValueResultMessage(error)

  promiseReceived: ->
    @round.promisesReceived += 1
    if @round.promisesReceived >= @quorum
      @startTransition 'proposalSucceeded'

  promiseRejectionReceived: ->
    @startTransition 'proposalFailed'

  queryReceived: (message) -> @sendMessage(message.sender, new Harry.QueryResponseMessage(@value))

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
