const functions = require("firebase-functions");

const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore()

exports.simulateGame = functions.https.onRequest(async (request, response) => {

    

    const attackPositions = ['CF', 'ST', 'RW', 'LW']
    const midfielderPosition = ['CM', 'CAM', 'CDM', 'LM', 'RM']
    const defencePositions = ['CB', 'LB', 'RB', 'LWB', 'RWB']

    const homeTeamName = request.body.homeTeam.name
    const awayTeamName = request.body.awayTeam.name

    const homeFormation = request.body.homeTeam.formation ? request.body.homeTeam.formation : [4, 3, 3]
    const awayFormation = request.body.awayTeam.formation ? request.body.awayTeam.formation : [4, 3, 3]

    let snapshotHomeGK = await db.collection("players").where('club', '==', homeTeamName).where('bestPosition', '==', 'GK').orderBy('overall', 'desc').limit(1).get()
    let snapshotHomeDefence = await db.collection("players").where('club', '==', homeTeamName).where('bestPosition', 'in', defencePositions).orderBy('overall', 'desc').limit(homeFormation[0]).get()
    let snapshotHomeMid = await db.collection("players").where('club', '==', homeTeamName).where('bestPosition', 'in', midfielderPosition).orderBy('overall', 'desc').limit(homeFormation[1]).get()
    let snapshotHomeAttack = await db.collection("players").where('club', '==', homeTeamName).where('bestPosition', 'in', attackPositions).orderBy('overall', 'desc').limit(homeFormation[2]).get()

    let snapshotAwayGK = await db.collection("players").where('club', '==', awayTeamName).where('bestPosition', '==', 'GK').orderBy('overall', 'desc').limit(1).get()
    let snapshotAwayDefence = await db.collection("players").where('club', '==', awayTeamName).where('bestPosition', 'in', defencePositions).orderBy('overall', 'desc').limit(awayFormation[0]).get()
    let snapshotAwayMid = await db.collection("players").where('club', '==', awayTeamName).where('bestPosition', 'in', midfielderPosition).orderBy('overall', 'desc').limit(awayFormation[1]).get()
    let snapshotAwayAttack = await db.collection("players").where('club', '==', awayTeamName).where('bestPosition', 'in', attackPositions).orderBy('overall', 'desc').limit(awayFormation[2]).get()
    
    //it consists of stats from midfielders and forwards players
    //positions: CM, AM, LM, RM, CF, S, SS
    //skills: Finishing, Curve, Ball Control, Shot Power, Vision, Dribbiling, Long Shots 
    //(Average of all 7 skill rates divided by a 100 to get an number from 0 to 1 rating)
    
    let homeTeamAttacking = 0

    snapshotHomeAttack.forEach(player => {
        player = player.data()
        rate = (player.finishing + player.curve + player.ballControl + player.shotPower + player.vision 
            + player.dribbling + player.longShots)/7
        homeTeamAttacking += isNaN(rate) ? Math.random()* (100 - 60) + 60 : rate
    })
    homeTeamAttacking = (homeTeamAttacking/snapshotHomeAttack.size)/100

    let awayTeamAttacking = 0
    snapshotAwayAttack.forEach(player => {
        player = player.data()
        rate = (player.finishing + player.curve + player.ballControl + player.shotPower + player.vision 
            + player.dribbling + player.longShots)/7
        awayTeamAttacking += isNaN(rate) ? Math.random()* (100 - 60) + 60 : rate
    })
    awayTeamAttacking = (awayTeamAttacking/snapshotAwayAttack.size)/100

    //it consists of stats from midfielders players
    //positions: 'CM', 'CAM', 'CDM', 'LM', 'RM'
    //skills: ballControl, shortPassing, volleys, dribbling, sprintSpeed, agility, crossing
    // balance, vision, strength, aggression, longPassing, acceleration
    //(Average of all 13 skill rates divided by a 100 to get an number from 0 to 1 rating)

    let homeTeamMid = 0

    snapshotHomeMid.forEach(player => {
        player = player.data()
        rate = (player.ballControl + player.shortPassing + player.volleys + player.dribbling + player.sprintSpeed
            + player.agility + player.crossing + player.balance + player.vision
            + player.strength + player.aggression + player.longPassing + player.acceleration)/13
        homeTeamMid += isNaN(rate) ? Math.random()* (100 - 40) + 40 : rate
    })
    homeTeamMid = (homeTeamMid/snapshotHomeMid.size)/100

    let awayTeamMid = 0
    snapshotAwayMid.forEach(player => {
        player = player.data()
        rate = (player.ballControl + player.shortPassing + player.volleys + player.dribbling + player.sprintSpeed
            + player.agility + player.crossing + player.balance + player.vision
            + player.strength + player.aggression + player.longPassing + player.acceleration)/13
        awayTeamMid += isNaN(rate) ? Math.random()* (100 - 40) + 40 : rate
    })
    awayTeamMid = (awayTeamMid/snapshotAwayMid.size)/100

    //it consists of stats from defender players
    //positions: 'CB', 'LB', 'RB', 'LWB', 'RWB'
    //skills: Ball Control, Agility, Reactions, Balance, Strength, Aggression, Interception, Standing and Sliding Tackles
    //(Average of all 9 skill rates then divided by a 100 to get an number from 0 to 1 rating)
    let homeTeamDefence = 0
    snapshotHomeDefence.forEach(player => {
        player = player.data()
        rate = (player.agility + player.reactions + player.ballControl + player.balance + player.vision 
            + player.strength + player.aggression + player.interceptions + player.standingTackle + player.slidingTackle)/9
        homeTeamDefence += isNaN(rate) ? Math.random()* (100 - 40) + 40 : rate
    })
    homeTeamDefence = (homeTeamDefence/snapshotHomeDefence.size)/100

    let awayTeamDefence = 0
    snapshotAwayDefence.forEach(player => {
        player = player.data()
        rate = (player.agility + player.reactions + player.ballControl + player.balance + player.vision 
            + player.strength + player.aggression + player.interceptions + player.standingTackle + player.slidingTackle)/9
        awayTeamDefence += isNaN(rate) ? Math.random()* (100 - 40) + 40 : rate
    })
    awayTeamDefence = (awayTeamDefence/snapshotAwayDefence.size)/100

    //skills: GKPositioning, GK Reflexes, GKHandling, GKDiving
    //(Average of all 4 skill rates then divided by a 100 to get an number from 0 to 1 rating)
    
    let homeTeamGK = 0 
    
    snapshotHomeGK.forEach(player =>{
        player = player.data()
        homeTeamGK += (player.GKPositioning + player.GKReflexes + player.GKHandling + player.GKDiving)/4
    })
    homeTeamGK = homeTeamGK/100

    let awayTeamGK = 0 
    
    snapshotAwayGK.forEach(player =>{
        player = player.data()
        awayTeamGK += (player.GKPositioning + player.GKReflexes + player.GKHandling + player.GKDiving)/4
    })
    awayTeamGK = awayTeamGK/100

    //prepare Variables for the simulation
    let homeTeamScore = 0
    let awayTeamScore = 0

    let teamInControl = "HOME"

    const eventTypes = {
        HomeAttack: "HA",
        AwayAttack: "AT",
        HomeDefenceCut: "HDC",
        AwayDefenceCut: "ADC",
        HomeMidfieldCut: "HMC",
        AwayMidfieldCut: "AMC",
        HomeScores: "HS",
        AwayScores: "AS",
        HomeGKStop: "HGKS",
        AwayGKStop: "AGKS",
        HalfTime: "HT",
        FullTime: "FT",
        KickOff: "KF"
      };

    let events = [eventTypes.KickOff]
    let shots = {home: 0, away:0}
    let shotsOnTarget = {home:0, away:0}
    let passes = {home:0, away: 0}
    let passesAccuarcy = {home: 0, away:0}
    let possession = {home:0, away:0}

    const iterations = 120

    for (let i = 0; i < iterations; i++) {

        if(i == Math.round(iterations/2)){
            events.push(eventTypes.HalfTime)
            teamInControl = "AWAY"
            continue
        }
            

        if(teamInControl == 'HOME'){

            possession.home += 1

            let prob = Math.random()
            if(prob <= homeTeamAttacking){
                passes.home += 1
                
                prob = Math.random()
                events.push(eventTypes.HomeAttack)
                if(prob <= awayTeamMid){
                    events.push(eventTypes.AwayMidfieldCut)
                }else{
                    passes.home += 1
                    prob = Math.random()
                    if(prob <= awayTeamDefence){
                        events.push(eventTypes.AwayDefenceCut)
                    }else{
                        shots.home += 1
                        shotsOnTarget.home += 1

                        if(prob > awayTeamGK){
                            events.push(eventTypes.HomeScores)
                            homeTeamScore++ 
                        }else{
                            let prob = Math.random()
                            if(prob >= 50){
                                shotsOnTarget.home += 1
                                events.push(eventTypes.AwayGKStop)
                            }
                        }
                        
                    }   
                    teamInControl = "AWAY"
                }
            }
        }else{
            possession.away += 1

            let prob = Math.random()
            if(prob <= awayTeamAttacking){
                possession.away += 1

                prob = Math.random()
                events.push(eventTypes.AwayAttack)
                if(prob <= homeTeamMid){
                    events.push(eventTypes.HomeMidfieldCut)
                    teamInControl = "HOME"
                }else{
                    prob = Math.random()
                    if(prob <= homeTeamDefence){
                        events.push(eventTypes.HomeDefenceCut)
                        teamInControl = "HOME"
                    }else{
                        if(prob > homeTeamGK){
                            events.push(eventTypes.AwayScores)
                            awayTeamScore++ 
                            teamInControl = "HOME"
                        }else{
                            events.push(eventTypes.HomeGKStop)
                            teamInControl = "HOME"
                        }
                    }
                }
            }
        }
        
    }

    events.push(eventTypes.FullTime)

    response.send({
        homeScore: homeTeamScore,
        awayScore: awayTeamScore,
        events: events
    });

});