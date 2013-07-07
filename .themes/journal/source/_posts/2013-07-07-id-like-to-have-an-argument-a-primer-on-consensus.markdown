---
layout: post
title: "I'd like to have an argument: A primer on consensus"
date: 2013-07-07 14:32
comments: true
featured_image: "/images/headers/fighting.jpg"
photo_credit: "<a href=\"http://analogromance.tumblr.com/\">Carter Brundage</a>"
categories: ['misc']
---

If you are, say, a piece of e-commerce software, and, say, you want a record of when your customers buy stuff, how might you ensure that how can you get a record of each transaction every single time one happens? Money is changing hands, and people aren't very fond of loosing money without any gain in return, so having a correct ledger for transactions sure is important.

You certainly can't just leave this record on one computer, since that computer's disk might die and leave you with none of your data. You could put it on two computers so that if one died you'd still have the record on the other computer, but you'd have to make sure that you write the information to both computers every time. Worse is that you must make sure that your cherished record gets written to both computers before you move on and accept more transactions, because if it doesn't assuredly make it to both places, there's a small chance you might only have one copy, and thus again risk loosing that data.

If, say, your data set grew to be so important that simple dual redundancy was inadequate, you could network some computers who would all be responsible for storing the data. Now that this is happened you are beginning to have an interesting problem: how does your system behave when one of these computers fails? Ideally, if only one of ten of the machines gets its power cord tripped over, you should still be able to add more stuff to the other computers. After all, the more computers we add to increase redundancy, the more likely any failure at all is to occur, since we now have ten things that can fail instead of just one. We still want to make sure that when we write some data to this cluster, it is assuredly written to some bunch of boxes, but ideally it doesn't need to be all ten so that the system can sustain inevitable failures.

### This isn't an argument, its just contradiction!

A possible strategy would be to designate one computer as the "master", who's responsibilities would be to manage all the incoming write requests from clients of the system by doling them out to the other computers which it knows are online. Designating a master sounds good since we now have one computer who can decide if the system is ready to accept writes. This is to say that if enough computers fail, our beloved transaction log should enter an "unwritable" state, where no transactions can occur because we can't safely store them. For the transaction log, we'd rather go down than loose data, again because people sure do love their money.

So, going with this strategy for a moment longer, we could program our master node to watch for node deaths, and decide if there is still enough online to continue accepting writes. There is one major glaring problem however: the master its self might fail. We'd need a new master, and lickity split. Then you might think, well, I'll just have some other computer detect that the master computer has failed, and designate another one as the master! Easy peasy.

As simple as that you have stumbled upon a tough computer science problem: reaching something called consensus. Whoever the remaining computers are after a master failure need to agree on who is going to be the next master. If all the computers lept up and declared themselves the master, we'd could start having two different data sets where depending on who you ask the same person has different amounts of money! If no computers declare themselves the master, the system stops working, and no one can buy stuff, which is also less than ideal.

The process these computers should follow is called reaching consensus: they need a provably correct way to agree on who the next master might be. Generalizing for a moment, the problem can be framed as such: in the presence of real life computers, that is to say ones which can fail unpredictably, how can we make them behave such that when failures inevitably occur, they continue to do useful work?

The consensus problem is one of the quintessential building blocks of distributed systems, and seems to be regarded as one of the tougher ones from both a conceptional and software engineering point of view. Depending on what sub set of the problem you look at, the aim is to define a rigorous process for submitting a value to a cluster of machines who will try reach consensus in the face of the expected failures, or unexpected ones like buggy software, or even  goodness gracious holy macaroni _malicious agents_ participating in the cluster. The cluster can agree to not accept a new value when one is submitted, or it can take a significant amount of time to accept it, but the key is that by the end of the process, the cluster "agrees" on what the "true" value is, be it the one it was before anything happened, or the newly submitted value. The "true" value here is a convenient yet misleading metaphor, since again, depending on who or how many people you ask, the answer is different. That said, the role of a consensus algorithm is to define both how to submit a new value to the system, and also how to retrieve the "true" value the system has adopted. A handy definition of the "true" value read algorithm is just to ask everyone and see what value the majority of the cluster thinks the value is.

The reasons this problem is challenging arise from the simple fact that both processes and humans are unreliable. Disks fail, cords get unplugged, engineers write bugs, and yet all the while we still want to buy stuff. It wouldn't be too tough to write a goofy consensus algorithm I shall enjoy titling "lol dunno" which just rejects any new incoming values in the event of any of these failures. Due to these failures' inevitability "lol dunno", despite being simple, is relatively useless. The consensus problem holds us engineers to a higher standard of coming up with a way for a cluster of processes with some errors to remain resilient and still accept new values for data.

### Argument is an intellectual process

Consensus problem solvers enjoy a number of horrid subproblems stemming from the fact that they must admit that there is such a thing as time. Many clients might try to propose a new value to the system around the same time, so problem solvers have to decide if they are going to impose an ordering on the operations the system takes. Messages between processes might arrive slowly, or even out of order as well, which means state has to be very carefully tracked by all actors in the show. A correct implementation of a solution to the problem must guarantee that one and only one value is agreed upon as the true value by the system at one instant. This means it must be completely resilient to conflicting clients proposing conflicting values, and bake in some sort of prevention of different factions of the system trying to pick one of the clients as the correct one.

All this boils ~~down~~ over into a few decades of research. As best I can tell, the state of the art consensus algorithm is one called [Paxos](http://en.wikipedia.org/wiki/Paxos_(computer_science)), so if you are looking to see how things relying on consensus are actually built, I'd say start there. Interestingly very recently a new consensus algorithm has risen to prominence in the zeitgeist: [Raft](https://ramcloud.stanford.edu/wiki/download/attachments/11370504/raft.pdf). Raft interests me because it's been designed for understandability as well as correctness, so it may be worth investigating as well. There's also a number of resources describing concrete implementations of Paxos and the myriad of challenges associated with it which are simultaneously horrifying and interesting.

### More resources:

 - Paxos author's list of papers: <http://research.microsoft.com/en-us/um/people/lamport/pubs/pubs.html>
 - Paxos author's simplest explanation of Paxos: <http://research.microsoft.com/en-us/um/people/lamport/pubs/paxos-simple.pdf>
 - Seminal paper on Raft: <https://ramcloud.stanford.edu/wiki/download/attachments/11370504/raft.pdf>
 - Raft's parent project, RAMCloud: <https://ramcloud.stanford.edu/wiki/display/ramcloud/RAMCloud>
 - Google's report on implementing Paxos: <http://www.read.seas.harvard.edu/~kohler/class/08w-dsi/chandra07paxos.pdf>
 - Microsoft's Will Portnoy's blog on implementing Paxos: <http://blog.willportnoy.com/2012/06/lessons-learned-from-paxos.html>
 - Monty Python's "Argument Clinic": <http://www.youtube.com/watch?v=kQFKtI6gn9Y>
