import Subscription from 'stripe'
import { getConfig } from '../utils/config'
import { stripe } from '../utils/StripeClientManager'
import { constructUpsertSql } from '../utils/helpers'
import { backfillCustomers } from './customers'
import { findMissingEntries, getUniqueIds, upsertMany } from './database_utils'
import Stripe from 'stripe'
import { subscriptionScheduleSchema } from '../schemas/subscription_schedules'

const config = getConfig()

export const upsertSubscriptionSchedules = async (
  subscriptionSchedules: Subscription.SubscriptionSchedule[],
  backfillRelatedEntities: boolean = true
): Promise<Subscription.SubscriptionSchedule[]> => {
  if (backfillRelatedEntities) {
    const customerIds = getUniqueIds(subscriptionSchedules, 'customer')

    await backfillCustomers(customerIds)
  }

  // Run it
  const rows = await upsertMany(subscriptionSchedules, () =>
    constructUpsertSql(
      config.SCHEMA || 'stripe',
      'subscription_schedules',
      subscriptionScheduleSchema
    )
  )

  return rows
}

export const backfillSubscriptionSchedules = async (subscriptionIds: string[]) => {
  const missingSubscriptionIds = await findMissingEntries('subscription_schedules', subscriptionIds)
  await fetchAndInsertSubscriptions(missingSubscriptionIds)
}

const fetchAndInsertSubscriptions = async (subscriptionIds: string[]) => {
  if (!subscriptionIds.length) return

  const subscriptionSchedules: Stripe.SubscriptionSchedule[] = []

  for (const subscriptionScheduleId of subscriptionIds) {
    const subscriptionSchedule = await stripe.subscriptionSchedules.retrieve(subscriptionScheduleId)
    subscriptionSchedules.push(subscriptionSchedule)
  }

  await upsertSubscriptionSchedules(subscriptionSchedules)
}
