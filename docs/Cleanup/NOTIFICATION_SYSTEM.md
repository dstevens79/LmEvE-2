# LMeve Notification System Documentation

The LMeve notification system provides comprehensive messaging capabilities through Discord webhooks and EVE Online in-game mail. This system allows for customizable message templates, role targeting, and intelligent throttling.

## Features

### Discord Integration
- **Webhook Support**: Send messages to Discord channels via webhooks
- **Rich Embeds**: Optional rich formatting with thumbnails and structured fields  
- **Role Mentions**: Ping specific Discord roles (@admins, @pilots, etc.)
- **Channel Targeting**: Mention multiple channels in notifications
- **User Mapping**: Map EVE character IDs to Discord users for direct mentions
- **Throttling**: Configurable rate limiting to prevent spam
- **Custom Templates**: Dynamic message templates with variable substitution

### EVE Online In-Game Mail
- **ESI Integration**: Send mail through EVE's official API
- **Multiple Recipients**: Support for individuals, mailing lists, corporations, and alliances
- **CSPA Filtering**: Skip recipients with high CSPA charges
- **Online Filtering**: Optionally only send to online characters
- **Template System**: Customizable subject lines and message bodies
- **Rate Limiting**: Respects EVE's API rate limits

## Configuration

### Discord Setup

1. **Create Discord Webhook**
   - Go to your Discord server settings
   - Navigate to Integrations → Webhooks
   - Click "New Webhook"
   - Copy the webhook URL

2. **Configure in LMeve**
   - Go to Settings → Notifications
   - Enable Discord Integration
   - Enter webhook URL
   - Set bot name and avatar (optional)
   - Configure channels and roles to mention
   - Set up message templates for each event type

### EVE Mail Setup

1. **ESI Authorization**
   - Ensure your corporation has ESI configured
   - The sender character needs mail sending permissions
   - Required ESI scope: `esi-mail.send_mail.v1`

2. **Configure Recipients**
   - Individual pilots: Enter character IDs
   - Mailing lists: Format as "ListName:MailingListID"
   - Corporation/Alliance: Toggle respective options

## Message Templates

Templates support variable substitution using `{variable_name}` syntax:

### Manufacturing Completion Variables
- `{pilot}` - Character name who completed the job
- `{item}` - Manufactured item name  
- `{count}` - Quantity produced
- `{time}` - Completion timestamp
- `{location}` - Manufacturing facility
- `{corporation}` - Corporation name
- `{alliance}` - Alliance name

### Queue Alert Variables  
- `{queue_type}` - Type of queue (Manufacturing, Research, etc.)
- `{remaining_jobs}` - Number of jobs remaining
- `{estimated_depletion}` - Time until queue empty
- `{corporation}` - Corporation name

### Killmail Variables
- `{pilot}` - Character involved in killmail
- `{ship_type}` - Ship type destroyed
- `{isk_value}` - Estimated ISK value
- `{system}` - Solar system name
- `{zkillboard_link}` - Link to zKillboard

### Market Alert Variables
- `{item}` - Item name
- `{price}` - Current price
- `{change}` - Percentage change
- `{action}` - Recommended action (buy/sell)
- `{system}` - Market system
- `{volume}` - Trade volume

## Example Templates

### Discord Manufacturing Template
```
Hey {pilot} - your LMeve industry task of {item} x{count} is complete at {time}! 
Location: {location}
```

### EVE Mail Queue Alert
```
Subject: LMeve Alert: {queue_type} Queue Running Low

Attention Corp Leadership,

The {queue_type} queues are running critically low with only {remaining_jobs} jobs remaining.

Immediate action required to setup additional industry tasking to maintain production efficiency.

Alert generated at: {time}

LMeve Management System
```

## Integration Examples

### Manufacturing Job Completion
```typescript
import { notify } from '@/lib/notification-manager';

await notify.manufacturingComplete({
  pilot: 'John Doe',
  pilotId: 123456,
  item: 'Rifter',
  itemId: 587,
  count: 10,
  location: 'Jita IV - Moon 4',
  corporation: 'Test Corp',
  corporationId: 98765
}, notificationSettings);
```

### Queue Monitoring
```typescript
await notify.queueAlert({
  queueType: 'Manufacturing',
  remainingJobs: 2,
  estimatedDepletion: '4 hours',
  corporation: 'Test Corp',
  corporationId: 98765,
  urgencyLevel: 'high'
}, notificationSettings);
```

## Throttling and Rate Limits

### Discord
- Default: 5 minutes between similar notifications
- Configurable per installation
- Prevents webhook spam

### EVE Mail  
- Default: 15 minutes between notifications
- Respects ESI rate limits (4 mails per minute)
- Higher throttling recommended for corp-wide mailings

## Testing

Use the test buttons in Settings → Notifications to verify:
- Webhook connectivity
- ESI authentication
- Template rendering
- Recipient delivery

## Troubleshooting

### Discord Issues
- **403 Forbidden**: Webhook URL invalid or expired
- **429 Rate Limited**: Reduce throttling time
- **Messages not appearing**: Check webhook permissions

### EVE Mail Issues  
- **403 Forbidden**: Character lacks mail permissions or token expired
- **400 Bad Request**: Invalid recipient IDs or malformed content
- **Too Many Recipients**: ESI limits bulk mail recipients

### Common Problems
- **No notifications sent**: Check event type toggles are enabled
- **Template variables not replaced**: Verify variable names match exactly
- **High CSPA charges**: Enable CSPA filtering to skip expensive recipients

## Security Considerations

- Store webhook URLs securely
- Protect ESI tokens with appropriate scopes
- Limit notification access to authorized roles
- Regular review of recipient lists
- Monitor for unauthorized usage

## Performance Tips

- Use mailing lists for large recipient groups
- Enable throttling to prevent spam
- Regular cleanup of inactive recipients  
- Monitor ESI endpoint health
- Cache CSPA charge information

This notification system integrates seamlessly with LMeve's manufacturing, market, and killmail monitoring to keep your corporation informed of important events.