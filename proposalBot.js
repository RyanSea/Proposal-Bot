const { Client, Intents, MessageEmbed} =  require('discord.js');
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILD_MESSAGES] });
const config = require('./config/config.json')
const Styx = config.styx; 

const ethers =  require("ethers");
const GrantDAOABI = require("./utils/GrantDAO.json").abi;
const MetaCartelABI = require("./utils/MetaCartel.json").abi;

const Provider = new ethers.providers.JsonRpcProvider(config.gnosis);
//const Provider = new ethers.providers.WebSocketProvider(config.alchemy, "rinkeby")

const Signer = new ethers.Wallet(config.privateKey, Provider);
//const dao = new ethers.Contract('0xd77A681C39387CE629D754A661E7fcD0CA2DBc4d', GrantDAOABI, Signer);
const metacartel = new ethers.Contract("0xb152B115c94275b54a3F0b08c1Aa1D21f32a659a", MetaCartelABI, Signer)

const chiliURL = "https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/320/apple/81/hot-pepper_1f336.png"
const metaChiliURL = "https://images.squarespace-cdn.com/content/v1/5c598e4ebfba3e5984563a0e/1565305053540-E97I3TTHCYHFU0DMW342/meta_chill+copy.png"
const proposalURL = "https://app.daohaus.club/dao/0x64/0xb152b115c94275b54a3f0b08c1aa1d21f32a659a/proposals/"
var url = "https://app.daohaus.club/dao/0x64/0xb152b115c94275b54a3f0b08c1aa1d21f32a659a/proposals/"

const chains = {

    "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d" : "wxDAI",
    "0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1" : "wETH"

}

var sponsoredProposals = []
var loggedProposals = []

/****************************
PROPOSAL FORMATTING FUNCTIONS
****************************/

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

function hyperlink(link){

    let tldStart, tldEnd, hyperlink, siteStart;

    tldStart = link.indexOf('.')
    if (tldStart < 0) return ""
    siteStart = link.indexOf('/') + 2

    tldEnd = link.indexOf('/', siteStart)
    hyperlink = link.slice(siteStart, tldEnd)

    return `[${hyperlink}](${link})`
}
// hyperlink("https://autocrat.xyz/some_page_this_can_get_very_long_and_not_good_to_look_at") -> "[https://autocrat.xyz](orginallink)"
// ——————————————————————————————————————


/*****************
PROPOSAL LISTENERS
*****************/

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

    // let server = bot.guilds.cache.get('847216800067485716')
    // let proposalChannel = server.channels.cache.find(channel => channel.name === "proposals")
    // await proposalChannel.send("Proposal Submitted")

    id = String(id)
    tribute = Number(tribute) / 10 ** 18
    tributeToken = tributeToken.toLowerCase()
    paymentToken = paymentToken.toLowerCase()
    details = JSON.parse(details)
    //the listener can fire multiple times for the same emit, so I check if it's already been logged.
    if (loggedProposals.includes(id)) return
    //Make sure Funding Proposals have a tribute
    if(details.proposalType === "Funding Proposal" && tribute < 10 || chains[tributeToken] !== "wxDAI") return

    let server = bot.guilds.cache.get('847216800067485716')
    let proposalChannel = server.channels.cache.find(channel => channel.name === "proposals")

    details = JSON.parse(details)

    let embed = new MessageEmbed()
        .setTitle(`${details.title}\n[AWAITING SPONSOR]`)
        .setURL(url + id)
        .setAuthor({ name: `🌶  ${details.proposalType.toUpperCase()}` })
        .setDescription(details.description)
        .setThumbnail(metaChiliURL)
        .setImage(metaChiliURL)
        .setColor('#E6EAEA')
        //.setFooter({ text: '🌶  Voting Period Not Yet Started' });
            
    if (details.link && details.link.replace(/\s/g, '')) {
        embed.addField("Link:", hyperlink("https://" + details.link), false)
    }
    
    if (Number(payment) > 0) {
        let num = String(Number(payment) / 10 ** 18)
        num = formatNum(num)
        embed.addField("Payment Requested:", `${num} ${chains[paymentToken]}`, false)
    }

    if (Number(shares) > 0){
        embed.addField("Shares Requested:", String(shares), false)
    }

    await proposalChannel.send({embeds : [embed]})
    loggedProposals.push(id)
    
})

// Adds Voting Fields On SponsorProposal Emit
metacartel.on('SponsorProposal', async (
    delegateKey, 
    member, 
    id) => 
{

    id = String(id)
    if(sponsoredProposals.includes(id)) return



    let proposal, embed, header
    let server = bot.guilds.cache.get('847216800067485716')
    let proposalChannel = server.channels.cache.find(channel => channel.name === "proposals")

    await proposalChannel.messages.fetch()
        .then(messages => messages.forEach(message => {
            if (message.embeds.length && message.embeds[0].url.slice(87) === id) {
                proposal = message
            }
        }))
    if (!proposal) return // TODO: Generate a Discord Embed
    embed = proposal.embeds[0]
    header = embed.title
    
    embed
        .setTitle(header.slice(0, header.indexOf('\n')))
        .addFields(
            {name: "Yes Votes", value: "0", inline: true},
            {name: "No Votes", value: "0", inline: true}
        )
    
    await proposal.edit({embeds: [embed]})
    loggedProposals = loggedProposals.filter(prop => prop !== id)
    sponsoredProposals.push(id)
})

// Updates Voting Fields On SubmitVote Emit
metacartel.on('SubmitVote', async id => {

    let proposal, proposalMessage, embed, yes, no
    id = String(id)

    let server = bot.guilds.cache.get('847216800067485716')
    let proposalChannel = server.channels.cache.find(channel => channel.name === "proposals")

    await proposalChannel.messages.fetch()
        .then(messages => messages.forEach(message => {
            if (message.embeds.length && message.embeds[0].url.slice(87) === id) {
                proposalMessage = message
            }
        }))
    
    embed = proposalMessage.embeds[0]
    proposal = await metacartel.proposals(id)
    console.log(Number(proposal.paymentRequested) / 10 ** 18)
    yes = String(proposal.yesVotes)
    no = String(proposal.noVotes)

    embed.fields.forEach(field => {
        if (field.name === "Yes Votes"){
            field.value = yes
        } else if (field.name === "No Votes") {
            field.value = no
        }
    })

    if (Number(yes) > Number(no)){
        embed.setColor("#27B90A") // Green
    } else {
        embed.setColor("#CA031C") // Red
    }
    
    await proposalMessage.edit({embeds : [embed]})
})

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
    

    await proposal.delete()
    sponsoredProposals = sponsoredProposals.filter(prop => prop !== id)
})

/***********
BOT COMMANDS
***********/

bot.on('ready', () => {
    console.log('Styx Has Risen')
})

bot.on('messageCreate', async msg => {

    let proposals, currentPeriod, ids
    let proposalChannel = msg.guild.channels.cache.find(channel => channel.name === "proposals")


    if (msg.content.startsWith('x')) {
        let sentience = bot.guilds.cache.get('847216800067485716')
        let propsalChnnael = sentience.channels.cache.find(channel => channel.name === "proposals")
        propsalChnnael.send("Test")
    }


    // Generates Embeds For Active Proposals — Run Upon Activation Of Bot
    if (msg.content.startsWith('!on')) {

        

        currentPeriod = String(await metacartel.getCurrentPeriod())
        proposals = await metacartel.queryFilter('SponsorProposal')
        
        ids = proposals
            .filter(prop => Number(String(prop.args.startingPeriod)) + 84 + 60 > Number(currentPeriod))
            .map(prop => String(prop.args.proposalId))

        proposals = await Promise.all(ids.map(prop => {
            return metacartel.proposals(prop).then(i => i)
        }))

        proposals.forEach(async (proposal, index) => {

            let details = JSON.parse(proposal.details)
            let yes = String(proposal.yesVotes)
            let no = String(proposal.noVotes)
            let payment = chains[proposal.paymentToken.toLowerCase()]
        

            let embed = new MessageEmbed()
                .setTitle(details.title)
                .setURL(url + ids[index])
                .setAuthor({ name: `🌶  ${details.proposalType.toUpperCase()}` })
                .setDescription(details.description)
                .setThumbnail(metaChiliURL)
                .setImage(metaChiliURL)
                //.setFooter({ text: '🌶  Voting ends in x amount of days' });
            
            if (details.link && details.link.replace(/\s/g, '')) {
                embed.addField("Link:", hyperlink("https://" + details.link), false)
            }
            
            if (Number(proposal.paymentRequested) > 0) {
                let num = String(Number(proposal.paymentRequested) / 10 ** 18)
                num = formatNum(num)
                embed.addField("Payment Requested:", `${num} ${payment}`, false)
            }

            if (Number(proposal.sharesRequested) > 0){
                embed.addField("Shares Requested:", String(proposal.sharesRequested), false)
            }

            embed.addFields(
                { name: 'Yes Votes', value: yes, inline: true },
                { name: 'No Votes', value: no, inline: true }
            )
            
            if (Number(yes) > Number(no)){
                embed.setColor("#27B90A")
            } else {
                embed.setColor("#CA031C")
            }

            await proposalChannel.send({ embeds: [embed] })
        })
    }

})


bot.login(Styx)