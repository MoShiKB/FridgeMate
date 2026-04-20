package com.project.fridgemate.data.remote.api

import com.project.fridgemate.data.remote.dto.ApiOkResponse
import com.project.fridgemate.data.remote.dto.CreateFridgeData
import com.project.fridgemate.data.remote.dto.CreateFridgeRequest
import com.project.fridgemate.data.remote.dto.FridgeDto
import com.project.fridgemate.data.remote.dto.FridgeMemberDetailDto
import com.project.fridgemate.data.remote.dto.JoinFridgeData
import com.project.fridgemate.data.remote.dto.JoinFridgeRequest
import com.project.fridgemate.data.remote.dto.PaginatedResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface FridgeApi {

    @POST("fridges")
    suspend fun createFridge(@Body request: CreateFridgeRequest): Response<ApiOkResponse<CreateFridgeData>>

    @POST("fridges/join")
    suspend fun joinFridge(@Body request: JoinFridgeRequest): Response<ApiOkResponse<JoinFridgeData>>

    @POST("fridges/leave")
    suspend fun leaveFridge(): Response<ApiOkResponse<Any>>

    @GET("fridges/me")
    suspend fun getMyFridge(): Response<ApiOkResponse<FridgeDto>>

    @GET("fridges/me/members")
    suspend fun getMyFridgeMembers(): Response<PaginatedResponse<FridgeMemberDetailDto>>
}
