package com.omni.user.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.omni.user.entity.SupportAiSuggestion;
import org.apache.ibatis.annotations.*;

import java.time.LocalDateTime;

@Mapper
public interface SupportAiSuggestionMapper extends BaseMapper<SupportAiSuggestion> {
    @Insert("INSERT INTO support_ai_suggestion " +
            "(conversation_id, agent_id, message_cutoff, context_digest, suggestion_text, summary, issue_type, " +
            "recommended_action, missing_information, source_evidence, model, prompt_version, status, create_time, update_time) " +
            "VALUES (#{conversationId}, #{agentId}, #{messageCutoff}, #{contextDigest}, #{suggestionText}, #{summary}, #{issueType}, " +
            "#{recommendedAction}, CAST(#{missingInformation} AS jsonb), CAST(#{sourceEvidence} AS jsonb), #{model}, #{promptVersion}, " +
            "#{status}, #{createTime}, #{updateTime})")
    @Options(useGeneratedKeys = true, keyProperty = "id", keyColumn = "id")
    int insertSuggestion(SupportAiSuggestion suggestion);

    @Select("SELECT id, conversation_id AS conversationId, agent_id AS agentId, message_cutoff AS messageCutoff, " +
            "context_digest AS contextDigest, suggestion_text AS suggestionText, summary, issue_type AS issueType, " +
            "recommended_action AS recommendedAction, missing_information::text AS missingInformation, " +
            "source_evidence::text AS sourceEvidence, model, prompt_version AS promptVersion, status, edited_text AS editedText, " +
            "failure_code AS failureCode, failure_reason AS failureReason, reject_reason AS rejectReason, create_time AS createTime, " +
            "update_time AS updateTime, accepted_at AS acceptedAt, edited_at AS editedAt, rejected_at AS rejectedAt " +
            "FROM support_ai_suggestion WHERE id = #{id}")
    SupportAiSuggestion selectSuggestionById(@Param("id") Long id);

    @Update("UPDATE support_ai_suggestion SET status = #{toStatus}, update_time = #{now}, accepted_at = #{now} " +
            "WHERE id = #{id} AND status = #{fromStatus} " +
            "AND message_cutoff = #{messageCutoff} AND context_digest = #{contextDigest}")
    int transitionToAccepted(@Param("id") Long id, @Param("fromStatus") String fromStatus,
                             @Param("toStatus") String toStatus, @Param("messageCutoff") Long messageCutoff,
                             @Param("contextDigest") String contextDigest, @Param("now") LocalDateTime now);

    @Update("UPDATE support_ai_suggestion SET status = #{toStatus}, edited_text = #{editedText}, " +
            "update_time = #{now}, edited_at = #{now} WHERE id = #{id} AND status = #{fromStatus} " +
            "AND message_cutoff = #{messageCutoff} AND context_digest = #{contextDigest}")
    int transitionToEdited(@Param("id") Long id, @Param("fromStatus") String fromStatus,
                            @Param("toStatus") String toStatus, @Param("editedText") String editedText,
                            @Param("messageCutoff") Long messageCutoff, @Param("contextDigest") String contextDigest,
                            @Param("now") LocalDateTime now);

    @Update("UPDATE support_ai_suggestion SET status = #{toStatus}, reject_reason = #{reason}, " +
            "update_time = #{now}, rejected_at = #{now} WHERE id = #{id} AND status = #{fromStatus}")
    int transitionToRejected(@Param("id") Long id, @Param("fromStatus") String fromStatus,
                             @Param("toStatus") String toStatus, @Param("reason") String reason,
                             @Param("now") LocalDateTime now);

    @Update("UPDATE support_ai_suggestion SET status = 'EXPIRED', update_time = #{now}, failure_code = NULL, failure_reason = NULL " +
            "WHERE id = #{id} AND status = #{fromStatus}")
    int expireIfCurrent(@Param("id") Long id, @Param("fromStatus") String fromStatus,
                        @Param("now") LocalDateTime now);

    @Update("UPDATE support_ai_suggestion SET status = 'READY', suggestion_text = #{suggestionText}, summary = #{summary}, " +
            "issue_type = #{issueType}, recommended_action = #{recommendedAction}, missing_information = CAST(#{missingInformation} AS jsonb), " +
            "source_evidence = CAST(#{sourceEvidence} AS jsonb), model = #{model}, update_time = #{now} " +
            "WHERE id = #{id} AND status = 'GENERATING'")
    int markReady(@Param("id") Long id, @Param("suggestionText") String suggestionText,
                  @Param("summary") String summary, @Param("issueType") String issueType,
                  @Param("recommendedAction") String recommendedAction,
                  @Param("missingInformation") String missingInformation,
                  @Param("sourceEvidence") String sourceEvidence,
                  @Param("model") String model, @Param("now") LocalDateTime now);

    @Update("UPDATE support_ai_suggestion SET status = 'FAILED', failure_code = #{failureCode}, " +
            "failure_reason = #{failureReason}, update_time = #{now} WHERE id = #{id} AND status = 'GENERATING'")
    int markFailed(@Param("id") Long id, @Param("failureCode") String failureCode,
                   @Param("failureReason") String failureReason, @Param("now") LocalDateTime now);
}
