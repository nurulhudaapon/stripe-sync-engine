import Subscription from 'stripe'
import { getConfig } from '../utils/config'
import { stripe } from '../utils/StripeClientManager'
import { constructUpsertSql } from '../utils/helpers'
import { subscriptionSchema } from '../schemas/subscription'
import { backfillCustomers } from './customers'
import { markDeletedSubscriptionItems, upsertSubscriptionItems } from './subscription_items'
import { findMissingEntries, getUniqueIds, upsertMany } from './database_utils'
import Stripe from 'stripe'

const config = getConfig()

export const upsertSubscriptions = async (
  subscriptions: Subscription.Subscription[],
  backfillRelatedEntities: boolean = true
): Promise<Subscription.Subscription[]> => {
  if (backfillRelatedEntities) {
    const customerIds = getUniqueIds(subscriptions, 'customer')

    await backfillCustomers(customerIds)
  }

  // Run it
  const rows = await upsertMany(subscriptions, () =>
    constructUpsertSql(config.SCHEMA || 'stripe', 'subscriptions', subscriptionSchema)
  )

  // Upsert subscription items into a separate table
  // need to run after upsert subscription cos subscriptionItems will reference the subscription
  const allSubscriptionItems = subscriptions.flatMap((subscription) => subscription.items.data)
  await upsertSubscriptionItems(allSubscriptionItems)

  // We have to mark existing subscription item in db as deleted
  // if it doesn't exist in current subscriptionItems list
  const markSubscriptionItemsDeleted: Promise<{ rowCount: number }>[] = []
  for (const subscription of subscriptions) {
    const subscriptionItems = subscription.items.data
    const subItemIds = subscriptionItems.map((x: Subscription.SubscriptionItem) => x.id)
    markSubscriptionItemsDeleted.push(markDeletedSubscriptionItems(subscription.id, subItemIds))
  }
  await Promise.all(markSubscriptionItemsDeleted)

  return rows
}

export const backfillSubscriptions = async (subscriptionIds: string[]) => {
  const missingSubscriptionIds = await findMissingEntries('subscriptions', subscriptionIds)
  await fetchAndInsertSubscriptions(missingSubscriptionIds)
}

const fetchAndInsertSubscriptions = async (subscriptionIds: string[]) => {
  if (!subscriptionIds.length) return

  const subscriptions: Stripe.Subscription[] = []

  for (const subscriptionId of subscriptionIds) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    subscriptions.push(subscription)
  }

  await upsertSubscriptions(subscriptions)
}
