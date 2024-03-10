import { Injectable } from '@nestjs/common'
import axios from 'axios'

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
      // console.log(response.data.routes[0].summary.fare.taxi)
      // console.log(response.data.routes[0].summary.distance)
      // console.log(response.data.routes[0].summary.duration)
      console.log('reponse.data:', response.data.routes[0].result_code)

      return response.data.routes[0]
    } catch (error) {
      throw new Error(`Failed to fetch directions: ${error.message}`)
    }
  }

  async getInfo2(
    originLat,
    originLng,
    wayPoint1Lat,
    wayPoint1Lng,
    wayPoint2Lat,
    wayPoint2Lng,
    destinationLat,
    destinationLng,
  ): Promise<any> {
    const REST_API_KEY = process.env.REST_API_KEY
    const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${originLng},${originLat}&destination=${destinationLng},${destinationLat}&waypoints=${wayPoint1Lng},${wayPoint1Lat}|${wayPoint2Lng},${wayPoint2Lat}&priority=RECOMMEND&car_fuel=GASOLINE&car_hipass=false&alternatives=false&road_details=false`
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
}
