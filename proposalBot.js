const { Client, Intents, MessageEmbed} =  require('discord.js');
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILD_MESSAGES] });
const config = require('./config/config.json')
const Chili = config.chili; 

const ethers =  require("ethers");
const GrantDAOABI = require("./utils/GrantDAO.json").abi;
const MetaCartelABI = require("./utils/MetaCartel.json").abi;

const Provider = new ethers.providers.JsonRpcProvider(config.gnosis);
//const Provider = new ethers.providers.WebSocketProvider(config.alchemy, "rinkeby")

const Signer = new ethers.Wallet(config.privateKey, Provider);
//const dao = new ethers.Contract('0xd77A681C39387CE629D754A661E7fcD0CA2DBc4d', GrantDAOABI, Signer);
const metacartel = new ethers.Contract("0xb152B115c94275b54a3F0b08c1Aa1D21f32a659a", MetaCartelABI, Signer)




var sponsoredProposals = []
var loggedProposals = []

/************
DAO VARIABLES
************/

const chains = {

    "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d" : "wxDAI",
    "0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1" : "wETH"

}
const url = "https://app.daohaus.club/dao/0x64/0xb152b115c94275b54a3f0b08c1aa1d21f32a659a/proposals/"
const chiliMan = "https://images.squarespace-cdn.com/content/v1/5c598e4ebfba3e5984563a0e/1565305053540-E97I3TTHCYHFU0DMW342/meta_chill+copy.png"
const summoningTime = 1614807080 // MetaCartel Moloch Summoning Time in UNIX Seconds
const periodDuration = 7200 // 7200 seconds = 2 hours


/****************************
PROPOSAL FORMATTING FUNCTIONS
****************************/

//50600 -> 50,600
function formatNum(num) {

    let decimals = "";
    if (num.indexOf(".") >= 0) {
        num = num.split(".")
        decimals += "." + num[1]
        num = num[0]
    }
    let result = ""
    for(let i = 0; i < num.length; i++) {
  
      result += num[i]
      if((i + 1 - num.length) % 3 === 0 && i + 1 < num.length) result += ","
      
    }

    return result + decimals
}

//https://forum.metacartel.com/xyzxyzxyz -> forum.metacartel.com
function hyperlink(link){

    let tldStart, tldEnd, hyperlink, siteStart;

    tldStart = link.indexOf('.')
    if (tldStart < 0) return ""
    siteStart = link.indexOf('/') + 2

    tldEnd = link.indexOf('/', siteStart)
    hyperlink = link.slice(siteStart, tldEnd)

    return `[${hyperlink}](${link})`
}

//@param: DAOHaus startingPeriod, i.e. periods since summoning time
function voteEndingTimestamp(startingPeriod) {

    startingPeriod = Number(startingPeriod)
    if(!startingPeriod) return
    let startingSeconds = startingPeriod * periodDuration + summoningTime
    let ending = new Date(startingSeconds * 1000)

    ending.setHours(ending.getHours() + 24 * 7)
    ending = ending[Symbol.toPrimitive]('number')
    ending = Math.floor(ending / 1000)

    return `<t:${ending}>`
}

async function createEmbed(id) {

    let proposal = await metacartel.proposals(id)
    let details = JSON.parse(proposal.details)
    let yes = Number(proposal.yesVotes)
    let no = Number(proposal.noVotes)
    let payment = chains[proposal.paymentToken.toLowerCase()]
    let voteEnding = voteEndingTimestamp(proposal.startingPeriod)
    let description = details.description
    let type =  details.proposalType ? details.proposalType.toUpperCase() : '\u200b'

    let embed = new MessageEmbed()
        .setTitle(details.title || '\u200b')
        .setURL(url + id)
        .setAuthor({ name: `🌶  ${type}` })
        .setThumbnail(chiliMan)
    
    if (Number(proposal.paymentRequested) > 0) {
        let num = String(Number(proposal.paymentRequested) / 10 ** 18)
        num = formatNum(num)
        embed.addField("Payment Requested:", `${num} ${payment}`, false)
    }

    if (Number(proposal.sharesRequested) > 0){
        embed.addField("Shares Requested:", String(proposal.sharesRequested), false)
    }

    let status, color
    if(!yes && !no) {
        [status, color] = ["Awaiting Votes",'#ebeff2']
    } else {
        [status, color] = yes > no ? ["Passing!","#137d02"] : ["Failing","#9c0909"];
    }
    embed.setColor(color)

    if(voteEnding) {
        
        embed.addFields(
            { name: 'Yes Votes', value: String(yes), inline: true },
            { name: 'No Votes', value: String(no), inline: true }
        )

    } else {
        status = "Awaiting Sponsor"
    }

    embed.addField("Status:", status, false)
    if (description) {
        if(description.length > 1024) description = description.slice(0,1020) + "..."
        embed.addField('Description:', description, false)
    }
    if (details.link && details.link.replace(/\s/g, '') && details.link.length < 1024) {
        embed.addField("Link:", hyperlink("https://" + details.link), false)
    }
    if(voteEnding) {
        embed.addField(`Voting Period Ends: ${voteEnding}`,'\u200b' , false )
    }

    return embed
}



/*****************
PROPOSAL LISTENERS
*****************/

//TODO? Filter for a minimum tribute on certain proposal types?
// Generates Embed On SubmitProposal Emit
metacartel.on('SubmitProposal', async (
    applicant, 
    shares, 
    loot, 
    tribute, 
    tributeToken, 
    payment, 
    paymentToken, 
    details, 
    flags, 
    id) => 
{

    id = String(id)
    if (loggedProposals.includes(id)) return
    loggedProposals.push(id)
    let server = bot.guilds.cache.get('847216800067485716')
    let proposalChannel = server.channels.cache.find(channel => channel.name === "proposals")

    let embed = await createEmbed(id)

    await proposalChannel.send({embeds : [embed] })
})

// Adds Voting Fields On SponsorProposal Emit
metacartel.on('SponsorProposal', async (
    delegateKey, 
    member, 
    id,
    idx,
    startingPeriod) => 
{

    id = String(id)
    if(sponsoredProposals.includes(id)) return
    sponsoredProposals.push(id)
    loggedProposals = loggedProposals.filter(prop => prop !== id)

    let proposal, embed
    let server = bot.guilds.cache.get('847216800067485716')
    let proposalChannel = server.channels.cache.find(channel => channel.name === "proposals")

    await proposalChannel.messages.fetch()
        .then(messages => messages.forEach(message => {
            if (message.embeds.length && message.embeds[0].url.slice(87) === id) {
                proposal = message
            }
        }))
    embed = await createEmbed(id)

    if (!proposal) {
        await proposalChannel.send({embeds: [embed] })
    } else {
        await proposal.edit({embeds: [embed] })
    }
})

// Updates Voting Fields On SubmitVote Emit
metacartel.on('SubmitVote', async id => {

    
    id = String(id)
    let proposal, embed
    let server = bot.guilds.cache.get('847216800067485716')
    let proposalChannel = server.channels.cache.find(channel => channel.name === "proposals")

    await proposalChannel.messages.fetch()
        .then(messages => messages.forEach(message => {
            if (message.embeds.length && message.embeds[0].url.slice(87) === id) {
                proposal = message
            }
        }))
    embed = await createEmbed(id)

    if (!proposal){
        await proposalChannel.send({embeds: [embed]})
    } else {
        await proposal.edit({embeds : [embed]})
    }
})

//Removes proposal
metacartel.on('ProcessProposal', async (index, id) => {

    let proposal
    let server = bot.guilds.cache.get('847216800067485716')
    let proposalChannel = server.channels.cache.find(channel => channel.name === "proposals")
    await proposalChannel.messages.fetch()
        .then(messages => messages.forEach(message => {
            if (message.embeds.length && message.embeds[0].url.slice(87) === id) {
                proposal = message
            }
        }))
    if (proposal){
        await proposal.delete()
    }
    sponsoredProposals = sponsoredProposals.filter(prop => prop !== id)
})

/***********
BOT COMMANDS
***********/

bot.on('ready', () => {
    console.log('Chili Man Has Arrived!')
})

bot.on('messageCreate', async msg => {
    

    // Generates Embeds For Active Proposals — Run Upon Activation Of Bot
    if (msg.content.startsWith('!activate chili man')) {

        let server = bot.guilds.cache.get('847216800067485716')
        let proposalChannel = server.channels.cache.find(channel => channel.name === "proposals")
        let currentPeriod = String(await metacartel.getCurrentPeriod())
        let proposals = await metacartel.queryFilter('SponsorProposal')
        
        let ids = proposals
            .filter(prop => Number(String(prop.args.startingPeriod)) + 84 > Number(currentPeriod))
            .map(prop => String(prop.args.proposalId))
        let currentProposals = {}

        let embedId
        await proposalChannel.messages.fetch()
        .then(messages => messages.forEach(async message => {
            if (message.embeds.length) {
                embedId = message.embeds[0].url.slice(87)
                if(embedId){
                    await message.delete()
                }
            }
        }))

        let embed
        ids.forEach(async (id) => {
            embed = await createEmbed(id)

            await proposalChannel.send({ embeds: [embed] })
        })
    }

})


bot.login(Chili)