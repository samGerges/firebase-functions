const functions = require("firebase-functions");

const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore()
const auth = admin.auth()

exports.simulateGame = functions.https.onRequest(async (request, response) => {

    const homeTeamName = request.body.homeTeam.name
    const awayTeamName = request.body.awayTeam.name

    const homeFormation = request.body.homeTeam.formation
    const awayFormation = request.body.awayTeam.formation

    const userId = request.body.userId 
    const leagueName = request.body.leagueName || "Premier League"


    let gameSim = new GameClass([], {home: 0, away:0}, {home: 0, away:0}, {home: 0, away:0}, {home: 0, away:0})

    let eventsClass = await gameSim.simulateGame(homeTeamName, homeFormation, awayTeamName, awayFormation)


    const gameScore = gameSim.getScore()
    const gameShots = gameSim.getShots()
    const gamePasses = gameSim.getPasses()
    const gamePossession = gameSim.getPossession()

    possessionTotal = gamePossession.home + gamePossession.away

    await updateLeagueStanding(userId, {homeTeam:homeTeamName, awayTeam:awayTeamName, score: gameSim.getScore()})

    let fixtureResult = await simulateTournmentFixture(userId, leagueName, [homeTeamName, awayTeamName])

    fixtureResult.push({homeTeam:homeTeamName, awayTeam:awayTeamName, score: gameSim.getScore()})

    await updateLeagueFixture(userId, fixtureResult)

    let gameResult = {
        homeTeamName: homeTeamName,
        awayTeamName: awayTeamName,
        homeScore: gameScore.home,
        awayScore: gameScore.away,
        stats:{
            gameShots,
            gamePasses,
            possession:{
                home: 55,
                away: 45
            }
        },
        events: eventsClass
    }

    await storeGameHistory(userId, gameResult)

    response.send(gameResult);

});

async function simulateTournmentFixture(userId, leagueName, excluded) {
    let league = leagueName

    let leagueSnapshot = await db.collection("clubs")
                                .where('league', '==', league)
                                .where('name', 'not-in', excluded)
                                .get()

    let leagueClubs = []

    //get clubs from the league
    leagueSnapshot.forEach(club => {
        leagueClubs.push(club.data().name)
    })

    //shuffle the league then split in half then randomly assign clubs from both arrays
    leagueClubs = leagueClubs.sort(function(){return 0.5 - Math.random()});

    //it should be perfect division as the total of teams is always even number
    const half = Math.ceil(leagueClubs.length / 2);

    const firstHalf = leagueClubs.slice(0, half)
    const secondHalf = leagueClubs.slice(half)

    let results = []

    for (let i = 0; i < half; i++){

        let gameSim = new GameClass([], {home: 0, away:0}, {home: 0, away:0}, {home: 0, away:0}, {home: 0, away:0})

        await gameSim.simulateGame(firstHalf[i], [4, 3, 3], secondHalf[i], [4, 3, 3])

        let gameResult = {homeTeam:firstHalf[i], awayTeam:secondHalf[i], score: gameSim.getScore()}

        await updateLeagueStanding(userId, gameResult)
        
        results.push(gameResult)

    }

    return results

}

async function storeGameHistory(userId, data){

    let docRef = db.collection("users").doc(userId).collection("history")

    await docRef.add(data)

}

async function updateLeagueStanding(userId, game)  {

    
    let leagueName = 'pr'

    let docRef = db.collection("users").doc(userId)

    let doc = await docRef.get()

    let leagues = doc.data().leagues

    let league = leagues[leagueName].standing

    let frTeamName = game.homeTeam
    let secTeamName = game.awayTeam
    let score = game.score

    let homeResult = "d"
    let awayResult = "d"

    if(score.home > score.away) {
        homeResult = "w"
        awayResult = "l"
    }else if(score.away > score.home){
        homeResult = "l"
        awayResult = "w"
    }

    let frTeamIndex = league.findIndex(team => team.name == frTeamName)
    let secTeamIndex = league.findIndex(team => team.name == secTeamName)

    if(frTeamIndex == -1){
        let team = createTeamObj(frTeamName)

        league.push(team)

        frTeamIndex = league.length -1
    } 
    if(secTeamIndex == -1){
        let team = createTeamObj(secTeamName)

        league.push(team)

        secTeamIndex = league.length -1
    } 

    frTeam = await updateTeamPoints(league[frTeamIndex], homeResult)    
    secTeam = await updateTeamPoints(league[secTeamIndex], awayResult)

    let updateObj = {}

    league[frTeamIndex] = frTeam
    league[secTeamIndex] = secTeam

    updateObj[`leagues.${leagueName}.standing`] = league

    await docRef.update(
        updateObj
    )
}

async function updateTeamPoints(team, result){

    team.played += 1
    
    if (result == "w"){
        //team won match
        team.won += 1
    }else if(result == "l"){
        //team lost match
        team.loss += 1
    }else if(result == "d"){
        //team draw
        team.draw += 1
    }

    team.points = team.won * 3 + team.draw * 1

    return team
    
}

async function updateLeagueFixture(userId, results){

    let leagueName = 'pr'

    let docRef = db.collection("users").doc(userId)

    let doc = await docRef.get()

    let leagues = doc.data().leagues

    let leagueFixture = leagues[leagueName].fixture

    let newFixture = {results}

    leagueFixture.push(newFixture)

    let updateObj = {}
    updateObj[`leagues.${leagueName}.fixture`] = leagueFixture

    await docRef.update(
        updateObj
    )
}

function createTeamObj(teamName){
    let obj = {
        name: teamName,
        played: 0,
        points: 0,
        won: 0,
        loss: 0,
        draw: 0
    }

    return obj
}

class GameClass{

    constructor(events, score, shots, passes, possession){
        this.events = events
        this.score = score
        this.shots = shots
        this.passes = passes
        this.possession = possession
    }
    
    eventTypes = {
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

    attackPositions = ['CF', 'ST', 'RW', 'LW']
    midfielderPosition = ['CM', 'CAM', 'CDM', 'LM', 'RM']
    defencePositions = ['CB', 'LB', 'RB', 'LWB', 'RWB']

    getScore(){
        return this.score
    }
    getShots(){
        return this.shots
    }

    getPasses(){
        return this.passes
    }

    getPossession(){
        return this.possession
    }

    pickPlayer(players){
        let random = Math.round(Math.random()*(players.length-1))
        return players[random]
    }

    async prepareTeam(teamName, formation = [4, 3, 3]){
        let snapshotGK = await db.collection("players").where('club', '==', teamName).where('bestPosition', '==', 'GK').orderBy('overall', 'desc').limit(1).get()
        let snapshotDefence = await db.collection("players").where('club', '==', teamName).where('bestPosition', 'in', this.defencePositions).orderBy('overall', 'desc').limit(formation[0]).get()
        let snapshotMid = await db.collection("players").where('club', '==', teamName).where('bestPosition', 'in', this.midfielderPosition).orderBy('overall', 'desc').limit(formation[1]).get()
        let snapshotAttack = await db.collection("players").where('club', '==', teamName).where('bestPosition', 'in', this.attackPositions).orderBy('overall', 'desc').limit(formation[2]).get()

        //it consists of stats from midfielders and forwards players
        //positions: CM, AM, LM, RM, CF, S, SS
        //skills: Finishing, Curve, Ball Control, Shot Power, Vision, Dribbiling, Long Shots 
        //(Average of all 7 skill rates divided by a 100 to get an number from 0 to 1 rating)
        
        let teamAttacking = 0

        let attackPlayers = []

        snapshotAttack.forEach(player => {
            player = player.data()
            attackPlayers.push(player.name)
            let rate = (player.finishing + player.curve + player.ballControl + player.shotPower + player.vision 
                + player.dribbling + player.longShots)/7
            teamAttacking += isNaN(rate) ? Math.random()* (100 - 60) + 60 : rate
        })
        teamAttacking = (teamAttacking/snapshotAttack.size)/100

        //it consists of stats from midfielders players
        //positions: 'CM', 'CAM', 'CDM', 'LM', 'RM'
        //skills: ballControl, shortPassing, volleys, dribbling, sprintSpeed, agility, crossing
        // balance, vision, strength, aggression, longPassing, acceleration
        //(Average of all 13 skill rates divided by a 100 to get an number from 0 to 1 rating)

        let teamMidfield = 0

        snapshotMid.forEach(player => {
            player = player.data()
            attackPlayers.push(player.name)
            let rate = (player.ballControl + player.shortPassing + player.volleys + player.dribbling + player.sprintSpeed
                + player.agility + player.crossing + player.balance + player.vision
                + player.strength + player.aggression + player.longPassing + player.acceleration)/13
            teamMidfield += isNaN(rate) ? Math.random()* (100 - 40) + 40 : rate
        })
        teamMidfield = (teamMidfield/snapshotMid.size)/100

        //it consists of stats from defender players
        //positions: 'CB', 'LB', 'RB', 'LWB', 'RWB'
        //skills: Ball Control, Agility, Reactions, Balance, Strength, Aggression, Interception, Standing and Sliding Tackles
        //(Average of all 9 skill rates then divided by a 100 to get an number from 0 to 1 rating)
        let teamDefence = 0
        snapshotDefence.forEach(player => {
            player = player.data()
            let rate = (player.agility + player.reactions + player.ballControl + player.balance + player.vision 
                + player.strength + player.aggression + player.interceptions + player.standingTackle + player.slidingTackle)/9
            teamDefence += isNaN(rate) ? Math.random()* (100 - 40) + 40 : rate
        })
        teamDefence = (teamDefence/snapshotDefence.size)/100

        let teamGK = 0 
    
        snapshotGK.forEach(player =>{
            player = player.data()
            teamGK += (player.GKPositioning + player.GKReflexes + player.GKHandling + player.GKDiving)/4
        })
        teamGK = teamGK/100


        return {teamAttacking, teamMidfield, teamDefence, teamGK, attackPlayers}
    }


    async simulateGame(home, homeForm, away, awayForm){
        
        let teamInControl = "HOME"

        const homeTeam = await this.prepareTeam(home, homeForm)
        const awayTeam = await this.prepareTeam(away, awayForm)

        
        this.events.push({code: this.eventTypes.KickOff, time: 1, player: ""})

        const iterations = 90

        for (let i = 1; i <= iterations; i++) {

            
    
            if(i == 45){
                let event = {code: this.eventTypes.HalfTime, time: i, player: ""}
                this.events.push(event)
                teamInControl = "AWAY"
                continue
            }
            
            if(teamInControl == 'HOME'){
                this.possession.home += 1
    
                let prob = Math.random()
                if(prob <= (homeTeam.teamAttacking + 0.05)){
                    //Home Team is attacking
                    this.passes.home += 2
                    
                    prob = Math.random()

                    let event = {code: this.eventTypes.HomeAttack, time: i, player: ""}
                    this.events.push(event)
                    if(prob <= (awayTeam.teamMidfield - 0.05)){
                        //Away Team' Midfield cuts the ball
                        let event = {code: this.eventTypes.AwayMidfieldCut, time: i, player: ""}
                        this.events.push(event)
                    }else{
                        this.passes.home += 2
                        prob = Math.random()+0.15
                        if(prob <= (awayTeam.teamDefence - 0.05)){
                            //Away Team's defence cuts the ball
                            let event = {code: this.eventTypes.AwayDefenceCut, time: i, player: ""}
                            this.events.push(event)
                        }else{
                            this.passes.home += 2
                            this.shots.home += 1
                            prob = Math.random()
                            if(prob > (awayTeam.teamGK - 0.15)){
                                //Home Team Scores
                                let playerScored = this.pickPlayer(homeTeam.attackPlayers)
                                let event = {code: this.eventTypes.HomeScores, time: i, player: playerScored}
                                this.events.push(event)
                                this.score.home += 1 
                            }else{
                                //Away Team's Goalkeeper Stops the ball
                                let event = {code: this.eventTypes.AwayGKStop, time: i, player: ""}
                                this.events.push(event)
                            }
                            teamInControl = "AWAY"
                            
                        }   
                        
                    }
                }else{
                    teamInControl = "AWAY"
                }
            }else{
                this.possession.away += 1
    
                let prob = Math.random()
                if(prob <= (awayTeam.teamAttacking - 0.02)){
                    this.passes.away += 2
                    //Away Team is attacking
                    prob = Math.random()
                    let event = {code: this.eventTypes.AwayAttack, time: i, player: ""}
                    this.events.push(event)
                    if(prob <= (homeTeam.teamMidfield - 0.02)){
                        //Home Team' Midfield cuts the ball
                        let event = {code: this.eventTypes.HomeMidfieldCut, time: i, player: ""}
                        this.events.push(event)
                    }else{
                        this.passes.away += 2
                        prob = Math.random()
                        if(prob <= (homeTeam.teamDefence - 0.05)){
                            //Home Team's defence cuts the ball
                            let event = {code: this.eventTypes.HomeDefenceCut, time: i, player: ""}
                            this.events.push(event)
                        }else{
                            this.passes.away += 2
                            this.shots.away += 1
                            prob = Math.random()+0.05
                            if(prob > homeTeam.teamGK){
                                  //Away Team scoress
                                let playerScored = this.pickPlayer(awayTeam.attackPlayers)
                                let event = {code: this.eventTypes.AwayScores, time: i, player: playerScored}
                                this.events.push(event)
                                this.score.away += 1 
                            }else{
                                //Home Team's Goalkeeper stops the ball
                                let event = {code: this.eventTypes.HomeGKStop, time: i, player: ""}
                                this.events.push(event)
                            }
                            teamInControl = "HOME"   
                        }
                    }
                    
                }else{
                    teamInControl = "HOME"
                }
            }
            
        }
        
        // let demoEvents = [
        //     {code: this.eventTypes.KickOff, time: 1, player: ""},
        //     {code: this.eventTypes.HomeAttack, time: 3, player: ""},
        //     {code: this.eventTypes.AwayDefenceCut, time: 4, player: ""},
        //     {code: this.eventTypes.AwayAttack, time: 5, player: ""},
        //     {code: this.eventTypes.AwayScores, time: 5, player: this.pickPlayer(awayTeam.attackPlayers)},
        //     {code: this.eventTypes.HomeAttack, time: 6, player: ""},
        //     {code: this.eventTypes.AwayGKStop, time: 10, player: ""},
        //     {code: this.eventTypes.AwayAttack, time: 11, player: ""},
        //     {code: this.eventTypes.HomeDefenceCut, time: 14, player: ""},
        //     {code: this.eventTypes.HomeAttack, time: 15, player: ""},
        //     {code: this.eventTypes.HomeScores, time: 44, player: this.pickPlayer(homeTeam.attackPlayers)},
        //     {code: this.eventTypes.HalfTime, time: 45, player: ""},
        //     {code: this.eventTypes.AwayAttack, time: 54, player: ""},
        //     {code: this.eventTypes.HomeMidfieldCut, time: 54, player: ""},
        //     {code: this.eventTypes.AwayAttack, time: 56, player: ""},
        //     {code: this.eventTypes.HomeGKStop, time: 60, player: ""},
        //     {code: this.eventTypes.HomeAttack, time: 65, player: ""},
        //     {code: this.eventTypes.HomeScores, time: 68, player: this.pickPlayer(homeTeam.attackPlayers)},
        //     {code: this.eventTypes.AwayAttack, time: 70, player: ""},
        //     {code: this.eventTypes.HomeGKStop, time: 75, player: ""},
        //     {code: this.eventTypes.HomeAttack, time: 80, player: ""},
        //     {code: this.eventTypes.HomeScores, time: 88, player: this.pickPlayer(homeTeam.attackPlayers)},
        //     {code: this.eventTypes.FullTime, time: 90, player: ""}
        // ]


        this.events.push({code: this.eventTypes.FullTime, time: 90, player: ""})

        return this.events
    }
}

exports.userCreated = functions.auth.user().onCreate(async (user) =>{

    const data = {
        leagues: {
            pr: {
                fixture: [],
                standing: []
            },
            lig: {
                fixture: [],
                standing: []
            },
            lalig: {
                fixture: [],
                standing: []
            },
            bund: {
                fixture: [],
                standing: []
            },
        }
    }

    await db.collection("users").doc(user.uid).set(data)

})
