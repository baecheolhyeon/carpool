import { Injectable } from '@nestjs/common'
import axios from 'axios'
import * as https from 'https'
import * as crypto from 'crypto'

@Injectable()
export class KakaoMobilityService {
  async getInfo(
    originLat,
    originLng,
    destinationLat,
    destinationLng,
  ): Promise<any> {
    const REST_API_KEY = process.env.REST_API_KEY
    const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${originLng},${originLat}&destination=${destinationLng},${destinationLat}&waypoints=&priority=RECOMMEND&car_fuel=GASOLINE&car_hipass=false&alternatives=false&road_details=false`
    console.log(url)
    try {
      const response = await axios.get(url, {
        headers: { Authorization: `KakaoAK ${REST_API_KEY}` },
      })

      console.log(response.data.routes[0])

      return response.data.routes[0]
    } catch (error) {
      throw new Error(`Failed to fetch directions: ${error.message}`)
    }
  }

  async getWaypointInfo(
    originLat,
    originLng,
    firstWaypointLat,
    firstWaypointLng,
    SecondWaypointLat,
    SecondWaypointLng,

    destinationLat,
    destinationLng,
  ): Promise<any> {
    const REST_API_KEY = process.env.REST_API_KEY

    const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${originLng},${originLat}&destination=${destinationLng},${destinationLat}&waypoints=${firstWaypointLng},${firstWaypointLat}|${SecondWaypointLng},${SecondWaypointLat}&priority=RECOMMEND&car_fuel=GASOLINE&car_hipass=false&alternatives=false&road_details=false`

    console.log(url)
    try {
      const response = await axios.get(url, {
        headers: { Authorization: `KakaoAK ${REST_API_KEY}` },
      })

      console.log(response.data.routes[0])

      return response.data.routes[0]
    } catch (error) {
      throw new Error(`Failed to fetch directions: ${error.message}`)
    }
  }

  async getInfo3(
    originLat,
    originLng,
    wayPoint1Lat,
    wayPoint1Lng,
    destinationLat,
    destinationLng,
  ): Promise<any> {
    const REST_API_KEY = process.env.REST_API_KEY
    const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${originLng},${originLat}&destination=${destinationLng},${destinationLat}&waypoints=${wayPoint1Lng},${wayPoint1Lat}&priority=RECOMMEND&car_fuel=GASOLINE&car_hipass=false&alternatives=false&road_details=false`
    console.log(url)
    try {
      const response = await axios.get(url, {
        headers: { Authorization: `KakaoAK ${REST_API_KEY}` },
      })
      // console.log(response.data.routes[0].summary.fare.taxi)
      // console.log(response.data.routes[0].summary.distance)
      // console.log(response.data.routes[0].summary.duration)
      console.log('reponse.data:', response.data.routes[0].result_code)

      return response.data.routes[0]
    } catch (error) {
      throw new Error(`Failed to fetch directions: ${error.message}`)
    }
  }

  async getPayment(fare): Promise<any> {
    const allowLegacyRenegotiationforNodeJsOptions = {
      httpsAgent: new https.Agent({
        // for self signed you could also add
        // rejectUnauthorized: false,
        // allow legacy server
        secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
      }),
    }
    const SECRET_KEY_PAYMENT = process.env.SECRET_KEY_PAYMENT

    const url = 'https://open-api.kakaopay.com/online/v1/payment/ready'

    try {
      const response = await axios({
        url,
        method: 'POST',
        headers: {
          Authorization: `SECRET_KEY ${SECRET_KEY_PAYMENT}`,
          'Content-Type': 'application/json',
        },
        data: {
          cid: 'TC0ONETIME',
          partner_order_id: 'partner_order_id',
          partner_user_id: 'partner_user_id',
          item_name: '택시요금',
          quantity: '1',
          total_amount: fare,
          tax_free_amount: '0',
          approval_url: 'https://d28b-175-195-1-208.ngrok-free.app/matchedPath',
          fail_url: 'https://d28b-175-195-1-208.ngrok-free.app/unmatchedPath',
          cancel_url: 'https://d28b-175-195-1-208.ngrok-free.app/unmatchedPath',
        },
        httpsAgent: new https.Agent({
          secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
        }),
      })

      console.log(response.data)

      return response.data
    } catch (error) {
      throw new Error(`Failed to fetch directions: ${error.message}`)
    }
  }

  async getApprove(tid, pgToken): Promise<any> {
    console.log('tid:', tid, pgToken)
    const allowLegacyRenegotiationforNodeJsOptions = {
      httpsAgent: new https.Agent({
        // for self signed you could also add
        // rejectUnauthorized: false,
        // allow legacy server
        secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
      }),
    }
    const SECRET_KEY_PAYMENT = process.env.SECRET_KEY_PAYMENT

    const url = 'https://open-api.kakaopay.com/online/v1/payment/approve'

    try {
      const response = await axios({
        url,
        method: 'POST',
        headers: {
          Authorization: `SECRET_KEY ${SECRET_KEY_PAYMENT}`,
          'Content-Type': 'application/json',
        },
        data: {
          cid: 'TC0ONETIME',
          tid: tid,
          partner_order_id: 'partner_order_id',
          partner_user_id: 'partner_user_id',
          pg_token: pgToken,
        },
        httpsAgent: new https.Agent({
          secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
        }),
      })

      console.log(response.data)

      return response
    } catch (error) {
      throw new Error(`Failed to fetch directions: ${error.message}`)
    }
  }
  async cancelPay(tid, fare): Promise<any> {
    console.log('cancel:', tid, fare)
    const allowLegacyRenegotiationforNodeJsOptions = {
      httpsAgent: new https.Agent({
        // for self signed you could also add
        // rejectUnauthorized: false,
        // allow legacy server
        secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
      }),
    }
    const SECRET_KEY_PAYMENT = process.env.SECRET_KEY_PAYMENT

    const url = 'https://open-api.kakaopay.com/online/v1/payment/cancel'

    try {
      const response = await axios({
        url,
        method: 'POST',
        headers: {
          Authorization: `SECRET_KEY ${SECRET_KEY_PAYMENT}`,
          'Content-Type': 'application/json',
        },
        data: {
          cid: 'TC0ONETIME',
          tid,
          cancel_amount: fare,
          cancel_tax_free_amount: 0,
        },
        httpsAgent: new https.Agent({
          secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
        }),
      })

      console.log(response)

      return response
    } catch (error) {
      throw new Error(`Failed to fetch directions: ${error.error_code}`)
    }
  }
}
