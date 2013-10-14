#= require vendor/d3.v2
#= require vendor/batman.statemachine
#= require vendor/async.min
#= require_tree .

window.mainVisualization = new Harry.NetworkVisualizer
  selector: "#main_demo"
  network: new Harry.Network(15)
  width: 720
  height: 540
  clientMargin: 50

#clientOnlyVisualization = new Harry.NetworkVisualizer
  #selector: "#client_demo"
  #width: 240
  #height: 120
  #labels: false
  #network: new Harry.Network
    #replicaCount: 3
    #baseNetworkDelay: 1000
    #networkDelayVariability: 0
    #proposeEvery: 3000
  #onStart: (visualization, network) ->
    #firstReplica = network.replicas[0]
    #network.clients[0].replicaIDForMessages = -> firstReplica.id
    #for replica in network.replicas
      #replica.startTransition('mute')

#prepareOnlyVisualization = new Harry.NetworkVisualizer
  #selector: "#prepare_demo"
  #width: 240
  #height: 120
  #labels: false
  #network: new Harry.Network
    #replicaCount: 3
    #baseNetworkDelay: 1000
    #networkDelayVariability: 0
  #proposeEvery: 3000
  #onStart: (visualization, network) ->
    #firstReplica = network.replicas[0]
    #network.clients[0].replicaIDForMessages = -> firstReplica.id

    #for replica in network.replicas when replica.id != firstReplica.id
      #replica.startTransition('mute')

    #firstReplica.on 'startSet', ->
      #clearTimeout @timeout
      #@startTransition 'mute'
      #@startTransition 'unmute'

#promiseVisualization = new Harry.NetworkVisualizer
  #selector: "#promise_demo"
  #width: 240
  #height: 120
  #labels: false
  #network: new Harry.Network
    #replicaCount: 3
    #baseNetworkDelay: 1000
    #networkDelayVariability: 0
  #proposeEvery: 3000
  #onStart: (visualization, network) ->
    #firstReplica = network.replicas[0]
    #network.clients[0].replicaIDForMessages = -> firstReplica.id

    #firstReplica.promiseReceived = ->
      #@round.promisesReceived += 1
      #if @round.promisesReceived >= @quorum
        #@startTransition 'mute'
        #@startTransition 'unmute'

#acceptVisualization = new Harry.NetworkVisualizer
  #selector: "#accept_demo"
  #width: 240
  #height: 120
  #labels: true
  #network: new Harry.Network
    #replicaCount: 3
    #baseNetworkDelay: 1000
    #networkDelayVariability: 0
  #proposeEvery: 4000
  #onStart: (visualization, network) ->
    #for replica in network.replicas
      #replica.acceptReceived = (message) ->
        #if message.sequenceNumber >= @get('highestSeenSequenceNumber')
          #@set('highestSeenSequenceNumber', message.sequenceNumber)
          #@set 'value', message.value

    #firstReplica = network.replicas[0]
    #network.clients[0].replicaIDForMessages = -> firstReplica.id

    #firstReplica.on 'proposalSucceeded', ->
      #clearTimeout @timeout
      #@startTransition 'mute'
      #@startTransition 'unmute'
