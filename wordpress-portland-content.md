# Sunday Musician Portland landing page and blog drafts
## WordPress install notes
- **site:** https://sundaymusician.com
- **public_description:** We match skilled musicians with churches that need them
- **theme_detected:** Kadence theme 1.4.5 from public assets
- **blocks_detected:** Kadence Blocks 3.7.1, Kadence Pro 1.2.1, Greenshift, Formidable Forms, Rank Math SEO
- **timezone_detected:** America/Los_Angeles
- **public_categories_detected:** [{'id': 16, 'name': 'Blogging'}, {'id': 67, 'name': 'News'}, {'id': 1, 'name': 'Uncategorized'}]
- **auth_note:** REST application-password auth returned rest_not_logged_in; XML-RPC is blocked by 403, so these payloads are ready to import/post once server auth passes Authorization through.

## Page payload
- Title: Find Worship Musicians in Portland, Oregon
- Slug: portland
- Status: draft
- Excerpt: Sunday Musician helps Portland-area churches find worship musicians for weekend services, special events, and last-minute gaps.

```html
<!-- wp:kadence/rowlayout {"uniqueID":"portland-hero","columns":1,"colLayout":"equal","bgColor":"#f8f5ee","align":"full","firstColumnWidth":0,"secondColumnWidth":0,"thirdColumnWidth":0,"fourthColumnWidth":0,"fifthColumnWidth":0,"sixthColumnWidth":0,"padding":["90","20","80","20"],"kbVersion":2} -->
<!-- wp:kadence/column {"uniqueID":"portland-hero-col","kbVersion":2} -->
<div class="wp-block-kadence-column kadence-columnportland-hero-col"><div class="kt-inside-inner-col"><!-- wp:kadence/advancedheading {"uniqueID":"portland-eyebrow","level":6,"content":"PORTLAND / VANCOUVER WORSHIP MUSICIAN NETWORK","color":"#6f4e37","fontSize":[16,"",""]} -->
<h6 class="kt-adv-headingportland-eyebrow wp-block-kadence-advancedheading" data-kb-block="kb-adv-headingportland-eyebrow">PORTLAND / VANCOUVER WORSHIP MUSICIAN NETWORK</h6>
<!-- /wp:kadence/advancedheading -->

<!-- wp:kadence/advancedheading {"uniqueID":"portland-h1","level":1,"content":"Find worship musicians in the Greater Portland area","fontSize":[54,"",38],"lineHeight":[1.05,"",1.08]} -->
<h1 class="kt-adv-headingportland-h1 wp-block-kadence-advancedheading" data-kb-block="kb-adv-headingportland-h1">Find worship musicians in the Greater Portland area</h1>
<!-- /wp:kadence/advancedheading -->

<!-- wp:paragraph {"fontSize":"large"} -->
<p class="has-large-font-size">Sunday Musician helps churches in Portland, Vancouver, Beaverton, Hillsboro, Gresham, Tigard, Lake Oswego, Newberg, and the surrounding area connect with skilled musicians for weekend services, special events, and last-minute gaps.</p>
<!-- /wp:paragraph -->

<!-- wp:kadence/advancedbtn {"uniqueID":"portland-hero-buttons"} -->
<div class="wp-block-kadence-advancedbtn kb-buttons-wrap kb-btns-portland-hero-buttons"><!-- wp:kadence/singlebtn {"uniqueID":"portland-church-btn","text":"Request a musician","link":"/request-a-musician/","color":"#ffffff","background":"#243b53","borderRadius":[6,6,6,6]} /-->
<!-- wp:kadence/singlebtn {"uniqueID":"portland-musician-btn","text":"Join as a musician","link":"/refer-a-musician/","color":"#243b53","background":"#ffffff","border":"#243b53","borderRadius":[6,6,6,6]} /--></div>
<!-- /wp:kadence/advancedbtn -->

<!-- wp:paragraph -->
<p><strong>Current local reach:</strong> 48 musicians are already on the list, with players in Portland, Vancouver, Beaverton, Camas, Newberg, Wilsonville, Lake Oswego, Ridgefield, Battle Ground, Tualatin, Milwaukie, Hillsboro, and more.</p>
<!-- /wp:paragraph --></div></div>
<!-- /wp:kadence/column -->
<!-- /wp:kadence/rowlayout -->

<!-- wp:kadence/rowlayout {"uniqueID":"portland-problem","columns":2,"colLayout":"equal","align":"wide","padding":["70","20","50","20"],"kbVersion":2} -->
<!-- wp:kadence/column {"uniqueID":"portland-problem-left","kbVersion":2} -->
<div class="wp-block-kadence-column kadence-columnportland-problem-left"><div class="kt-inside-inner-col"><!-- wp:kadence/advancedheading {"uniqueID":"portland-problem-heading","level":2,"content":"When a worship team has a gap, Sunday comes fast"} -->
<h2 class="kt-adv-headingportland-problem-heading wp-block-kadence-advancedheading" data-kb-block="kb-adv-headingportland-problem-heading">When a worship team has a gap, Sunday comes fast</h2>
<!-- /wp:kadence/advancedheading -->
<!-- wp:paragraph -->
<p>A drummer gets sick. A bass player is out of town. Your keys player has a family emergency. Or you are planning a Good Friday service, Christmas Eve, a conference, or a fifth Sunday worship set and need a musician your regular team does not have.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>Most churches solve this by texting the same few people until somebody says yes. That works until it does not. Sunday Musician gives Portland-area churches another option: a growing local list of worship musicians who understand church culture and are open to serving where there is a real need.</p>
<!-- /wp:paragraph --></div></div>
<!-- /wp:kadence/column -->
<!-- wp:kadence/column {"uniqueID":"portland-problem-right","kbVersion":2} -->
<div class="wp-block-kadence-column kadence-columnportland-problem-right"><div class="kt-inside-inner-col"><!-- wp:kadence/advancedheading {"uniqueID":"portland-help-heading","level":3,"content":"Good fits for Sunday Musician"} -->
<h3 class="kt-adv-headingportland-help-heading wp-block-kadence-advancedheading" data-kb-block="kb-adv-headingportland-help-heading">Good fits for Sunday Musician</h3>
<!-- /wp:kadence/advancedheading -->
<!-- wp:list -->
<ul><li>Last-minute substitute musicians</li><li>Drums, bass, electric guitar, acoustic guitar, keys, piano, vocals, and MDs</li><li>Special services that need extra musical support</li><li>Churches giving volunteers a week off</li><li>Church plants building their first reliable bench</li><li>Teams that need a guest musician who can prepare well and serve humbly</li></ul>
<!-- /wp:list --></div></div>
<!-- /wp:kadence/column -->
<!-- /wp:kadence/rowlayout -->

<!-- wp:kadence/rowlayout {"uniqueID":"portland-how","columns":3,"colLayout":"equal","bgColor":"#ffffff","align":"wide","padding":["40","20","50","20"],"kbVersion":2} -->
<!-- wp:kadence/column {"uniqueID":"portland-step-one","kbVersion":2} -->
<div class="wp-block-kadence-column kadence-columnportland-step-one"><div class="kt-inside-inner-col"><!-- wp:heading {"level":3} --><h3>1. Tell us what you need</h3><!-- /wp:heading --><!-- wp:paragraph --><p>Share the instrument, date, rehearsal details, service times, budget, and any expectations that will help us find the right fit.</p><!-- /wp:paragraph --></div></div>
<!-- /wp:kadence/column -->
<!-- wp:kadence/column {"uniqueID":"portland-step-two","kbVersion":2} -->
<div class="wp-block-kadence-column kadence-columnportland-step-two"><div class="kt-inside-inner-col"><!-- wp:heading {"level":3} --><h3>2. We look for a fit</h3><!-- /wp:heading --><!-- wp:paragraph --><p>We check for skill, availability, location, church context, and whether the musician can come prepared for your service.</p><!-- /wp:paragraph --></div></div>
<!-- /wp:kadence/column -->
<!-- wp:kadence/column {"uniqueID":"portland-step-three","kbVersion":2} -->
<div class="wp-block-kadence-column kadence-columnportland-step-three"><div class="kt-inside-inner-col"><!-- wp:heading {"level":3} --><h3>3. You connect directly</h3><!-- /wp:heading --><!-- wp:paragraph --><p>Once there is a likely match, you can handle charts, set lists, rehearsal logistics, payment details, and relational fit directly.</p><!-- /wp:paragraph --></div></div>
<!-- /wp:kadence/column -->
<!-- /wp:kadence/rowlayout -->

<!-- wp:kadence/rowlayout {"uniqueID":"portland-local","columns":2,"colLayout":"equal","bgColor":"#eef4f8","align":"full","padding":["70","20","70","20"],"kbVersion":2} -->
<!-- wp:kadence/column {"uniqueID":"portland-local-left","kbVersion":2} -->
<div class="wp-block-kadence-column kadence-columnportland-local-left"><div class="kt-inside-inner-col"><!-- wp:kadence/advancedheading {"uniqueID":"portland-local-heading","level":2,"content":"Built locally before it scales anywhere else"} -->
<h2 class="kt-adv-headingportland-local-heading wp-block-kadence-advancedheading" data-kb-block="kb-adv-headingportland-local-heading">Built locally before it scales anywhere else</h2>
<!-- /wp:kadence/advancedheading -->
<!-- wp:paragraph -->
<p>Sunday Musician is starting in the Portland / Vancouver area on purpose. The goal is not to make church staffing feel transactional. The goal is to build a trusted network slowly, learn what worship leaders actually need, and help musicians serve churches without getting lost in a spreadsheet or last-minute group text.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>If you lead worship in the metro area, we would love to hear how your church handles gaps now, what has worked, and what would make this kind of network genuinely helpful.</p>
<!-- /wp:paragraph --></div></div>
<!-- /wp:kadence/column -->
<!-- wp:kadence/column {"uniqueID":"portland-local-right","kbVersion":2} -->
<div class="wp-block-kadence-column kadence-columnportland-local-right"><div class="kt-inside-inner-col"><!-- wp:heading {"level":3} --><h3>Serving churches around the metro area</h3><!-- /wp:heading --><!-- wp:list --><ul><li>Portland</li><li>Vancouver</li><li>Beaverton and Hillsboro</li><li>Gresham and Happy Valley</li><li>Tigard, Tualatin, and Lake Oswego</li><li>Oregon City and Milwaukie</li><li>Newberg, Wilsonville, Camas, Washougal, Ridgefield, and Battle Ground</li></ul><!-- /wp:list --></div></div>
<!-- /wp:kadence/column -->
<!-- /wp:kadence/rowlayout -->

<!-- wp:kadence/rowlayout {"uniqueID":"portland-cta","columns":1,"colLayout":"equal","align":"wide","padding":["70","20","80","20"],"kbVersion":2} -->
<!-- wp:kadence/column {"uniqueID":"portland-cta-col","kbVersion":2} -->
<div class="wp-block-kadence-column kadence-columnportland-cta-col"><div class="kt-inside-inner-col"><!-- wp:kadence/advancedheading {"uniqueID":"portland-cta-heading","level":2,"content":"Need a musician for an upcoming service?"} -->
<h2 class="kt-adv-headingportland-cta-heading wp-block-kadence-advancedheading" data-kb-block="kb-adv-headingportland-cta-heading">Need a musician for an upcoming service?</h2>
<!-- /wp:kadence/advancedheading -->
<!-- wp:paragraph {"fontSize":"large"} --><p class="has-large-font-size">Start with a request. If your church has not created a profile yet, add the church first so we can understand your context before we look for a fit.</p><!-- /wp:paragraph -->
<!-- wp:kadence/advancedbtn {"uniqueID":"portland-final-buttons"} --><div class="wp-block-kadence-advancedbtn kb-buttons-wrap kb-btns-portland-final-buttons"><!-- wp:kadence/singlebtn {"uniqueID":"portland-request-final","text":"Request a musician","link":"/request-a-musician/","color":"#ffffff","background":"#243b53","borderRadius":[6,6,6,6]} /--><!-- wp:kadence/singlebtn {"uniqueID":"portland-profile-final","text":"Add your church profile","link":"/request-a-musician/","color":"#243b53","background":"#ffffff","border":"#243b53","borderRadius":[6,6,6,6]} /--></div><!-- /wp:kadence/advancedbtn --></div></div>
<!-- /wp:kadence/column -->
<!-- /wp:kadence/rowlayout -->
```

## Blog drafts

### How Portland churches can prepare for last-minute worship musician cancellations
- Slug: portland-churches-last-minute-worship-musician-cancellations
- Status: draft
- Excerpt: A practical backup plan for Portland-area worship leaders when a musician cancels close to Sunday.

```html
<!-- wp:paragraph -->
<p>Every worship leader has had that text. It usually lands on Thursday night or Saturday morning: "I am so sorry, but I cannot make it this weekend." Sometimes it is a drummer. Sometimes it is the only person who knows the keys parts. Sometimes it is the vocalist who was carrying the melody on a song the congregation already knows.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>In Portland, the problem has an extra wrinkle. Many churches pull from the same circle of musicians. A player may live in Vancouver, work in Beaverton, rehearse in Portland, and serve at a church in Newberg. When one church is scrambling, there is a good chance another church has already asked the same few people.</p>
<!-- /wp:paragraph -->
<!-- wp:heading --><h2>Start with the services that are hardest to cover</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Look back over the last year and name the weekends that created the most stress. For many churches, it is holiday weekends, fifth Sundays, summer travel, Christmas Eve, Good Friday, and the first few weeks after school starts. Those are the dates to plan for before anyone cancels.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Know which instruments are fragile</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Most teams have one or two spots that are harder to replace. Drums and keys are common. Bass can be harder than expected. A strong acoustic player who can also lead vocally may be rare in a smaller church. Write those spots down. Do not wait until a cancellation exposes the weakness.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Keep a short backup list, not a random contact list</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>A backup list should include more than a name and phone number. Add instrument, location, typical availability, pay expectations, worship style, chart comfort, in-ear monitor experience, and whether the person is comfortable with tracks or click. That information saves time when Sunday is close.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Make the ask clear</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>A musician can answer faster when the details are in one message: date, rehearsal time, service times, location, set list, charts, recordings, expected dress, pay, and who they will report to when they arrive. A clear ask also communicates respect.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Use outside musicians without outsourcing discipleship</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Bringing in a guest musician does not mean your church has stopped developing its own people. Sometimes it gives volunteers rest. Sometimes it keeps a service from getting thrown together. Sometimes it lets a younger player sit next to someone with more experience and learn.</p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>Sunday Musician is being built for this exact kind of need in the Portland / Vancouver area. If your church needs a drummer, guitarist, bassist, keys player, vocalist, or other worship musician, start with a request and we will look for a fit.</p><!-- /wp:paragraph -->
```

### Building a healthy backup musician list for your Portland worship team
- Slug: building-backup-musician-list-portland-worship-team
- Status: draft
- Excerpt: How worship pastors can build a backup musician bench without burning out the same small group of volunteers.

```html
<!-- wp:paragraph -->
<p>A healthy worship team needs more than the people scheduled this Sunday. It needs a bench. Not a faceless list of hired players, but a group of trusted musicians who can step in when the normal rotation needs help.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>That matters in the Portland area because churches are spread across a wide metro: Portland, Vancouver, Beaverton, Hillsboro, Gresham, Tigard, Lake Oswego, Newberg, Camas, Ridgefield, and everything in between. Distance, traffic, family schedules, and church commitments all affect whether someone can actually say yes.</p>
<!-- /wp:paragraph -->
<!-- wp:heading --><h2>Define what "ready" means for your church</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>One church may need musicians who can read Nashville numbers, play with tracks, and follow an MD. Another may need someone who can listen well, keep things simple, and support a smaller room. Neither is wrong. The mistake is assuming every good musician is a good fit for every church.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Separate skill from fit</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Skill matters, but fit matters too. A great player who overplays every song may create more work for the worship leader. A less flashy player who listens, prepares, and serves the room may be the better call. Your backup list should include notes about both.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Ask your current team who they trust</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Your musicians probably know players from other churches, sessions, schools, worship nights, and local bands. Ask them for names, but also ask why they trust them. "Great drummer" is useful. "Great drummer, shows up prepared, good with click, lives in Vancouver, prefers two weeks notice" is much more useful.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Do not make every backup request an emergency</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>If the only time you contact outside musicians is when you are desperate, the relationship starts under pressure. Reach out before you need them. Learn their availability. Invite them to a rehearsal night. Keep the connection warm.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Protect your volunteers</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>A backup list is not just for emergencies. It can help your regular volunteers take vacations, attend family events, and worship from the congregation once in a while. That is not a luxury. Over time, it can be the difference between a team that lasts and a team that quietly burns out.</p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>Sunday Musician is working to make that backup list easier for churches around Portland and Vancouver. If you are building your bench, we would love to help you connect with musicians who understand worship ministry and local church life.</p><!-- /wp:paragraph -->
```

### What to look for when inviting a guest musician into your worship ministry
- Slug: what-to-look-for-guest-musician-worship-ministry-portland
- Status: draft
- Excerpt: A worship leader's guide to choosing guest musicians who can serve the room, not just play the parts.

```html
<!-- wp:paragraph -->
<p>Guest musicians can be a gift to a church. They can cover a gap, bring a fresh sound, support a special service, or give tired volunteers a needed break. They can also create stress if the fit is wrong.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>For worship leaders in the Portland area, the question is not simply, "Can this person play?" The better question is, "Can this person serve our church well this weekend?"</p>
<!-- /wp:paragraph -->
<!-- wp:heading --><h2>Look for preparation, not just talent</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>A prepared musician listens to the set before rehearsal, checks the keys, asks good questions, and knows when to keep a part simple. Talent helps. Preparation helps more, especially when the musician is stepping into a team they do not know.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Pay attention to musical humility</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Some rooms need energy. Some need restraint. A guest musician should be able to read the service and support the worship leader instead of trying to prove they belong. The best players usually make the team feel more confident, not more crowded.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Clarify the church context</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>A church plant in a school cafeteria, a traditional congregation adding modern songs, and a large church running tracks all need different things. Tell the guest musician what kind of room they are walking into. Share the style, expectations, rehearsal flow, and any sensitive dynamics they should know.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Talk through logistics early</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Do not leave practical details until Saturday night. Confirm call time, parking, gear, charts, tracks, dress, payment, service length, and who will meet them when they arrive. Good logistics make relational trust easier.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Debrief after the weekend</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>After the service, make a few notes. Was the musician prepared? Did they listen well? Were they easy to communicate with? Would you invite them again? Those notes help you make better decisions the next time you need support.</p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>Sunday Musician exists to help churches make those connections with more care. If your Portland-area church needs a guest musician, we can help look for someone with the right skill, availability, and fit for your context.</p><!-- /wp:paragraph -->
```
